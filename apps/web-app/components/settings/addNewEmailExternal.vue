<script setup lang="ts">
  import type { UiColor } from '@u22n/types/ui';
  import { z } from 'zod';
  import {
    computed,
    ref,
    storeToRefs,
    useNuxtApp,
    useToast,
    watch,
    watchDebounced
  } from '#imports';
  import type { TypeId } from '@u22n/utils';
  import { useEEStore } from '~/stores/eeStore';

  const { $trpc } = useNuxtApp();

  const newIdentityEmailValue = ref('');
  const newIdentityEmailValid = ref<boolean | 'remote' | null>(null);
  const newIdentityEmailValidationMessage = ref('');
  const newIdentitySendNameValue = ref('');
  const newIdentitySendNameValid = ref<boolean | 'remote' | null>(null);

  const smtpHost = ref('');
  const smtpHostValid = ref(false);
  const smtpPort = ref('');
  const smtpPortValid = ref(false);
  const smtpUsername = ref('');
  const smtpUsernameValid = ref(false);
  const smtpPassword = ref('');
  const smtpPasswordValid = ref(false);
  type SmtpEncryptionMethods = 'none' | 'ssl' | 'tls' | 'starttls';
  const smtpEncryptionMethods: SmtpEncryptionMethods[] = [
    'none',
    'ssl',
    'tls',
    'starttls'
  ];
  const smtpEncryptionMethod = ref<SmtpEncryptionMethods>(
    smtpEncryptionMethods[0] as SmtpEncryptionMethods
  );
  type SmtpAuthMethods = 'plain' | 'login';
  const smtpAuthMethods: SmtpAuthMethods[] = ['plain', 'login'];
  const smtpAuthMethod = ref<SmtpAuthMethods>(
    smtpAuthMethods[0] as SmtpAuthMethods
  );

  const smtpValid = ref(false);
  const smtpValidationLoading = ref(false);

  const buttonLabel = ref('Create New Email Address');
  const buttonLoading = ref(false);
  const emit = defineEmits(['close', 'openInternal']);

  const smtpFormValid = computed(() => {
    return (
      smtpHostValid.value === true &&
      smtpPortValid.value === true &&
      smtpUsernameValid.value === true &&
      smtpPasswordValid.value === true
    );
  });

  const formValid = computed(() => {
    if (isPro.value === false) {
      return (
        smtpValid.value === true &&
        newIdentityEmailValid.value === true &&
        newIdentitySendNameValid.value === true &&
        (selectedOrgTeams.value.length > 0 ||
          selectedOrgMembers.value.length > 0) &&
        !multipleDestinationsSelected.value
      );
    }
    return (
      smtpValid.value === true &&
      newIdentityEmailValid.value === true &&
      newIdentitySendNameValid.value === true &&
      (selectedOrgTeams.value.length > 0 || selectedOrgMembers.value.length > 0)
    );
  });

  // get list of teams
  const { data: orgTeamsData, pending: orgTeamPending } =
    await $trpc.org.users.teams.getOrgTeams.useLazyQuery({}, { server: false });
  interface OrgUserTeams {
    publicId: TypeId<'teams'>;
    avatarTimestamp: Date | null;
    name: String;
    description: String | null;
    color: String | null;
  }
  const orgUserTeams = ref<OrgUserTeams[]>([]);

  watch(orgTeamsData, (newOrgUserTeamsData) => {
    if (newOrgUserTeamsData?.teams) {
      for (const team of newOrgUserTeamsData.teams) {
        orgUserTeams.value.push({
          publicId: team.publicId,
          avatarTimestamp: team.avatarTimestamp,
          name: team.name,
          description: team.description,
          color: team.color
        });
      }
    }
  });

  const selectedOrgTeams = ref<OrgUserTeams[]>([]);

  // get list of users
  const { data: orgMembersData, pending: orgMembersPending } =
    await $trpc.org.users.members.getOrgMembersList.useLazyQuery(
      {},
      { server: false }
    );
  interface OrgMembers {
    publicId: TypeId<'orgMembers'>;
    profilePublicId: TypeId<'orgMemberProfile'>;
    avatarTimestamp: Date | null;
    name: String;
    handle: String;
    title: String | null;
    keywords: String;
  }
  const orgMembers = ref<OrgMembers[]>([]);

  watch(orgMembersData, (newOrgMembersData) => {
    if (newOrgMembersData?.members) {
      for (const member of newOrgMembersData.members) {
        orgMembers.value.push({
          publicId: member.publicId,
          profilePublicId: member.profile?.publicId,
          avatarTimestamp: member.profile?.avatarTimestamp,
          name:
            member.profile?.firstName + ' ' + member.profile?.lastName || '',
          handle: member.profile?.handle || '',
          title: member.profile?.title || '',
          keywords:
            member.profile?.firstName +
            ' ' +
            member.profile?.lastName +
            '  @' +
            member.profile?.handle +
            ' ' +
            member.profile?.title
        });
      }
    }
  });

  const selectedOrgMembers = ref<OrgMembers[]>([]);

  async function checkEmailAvailability() {
    if (
      newIdentityEmailValid.value === 'remote' ||
      newIdentityEmailValidationMessage.value === 'Select domain'
    ) {
      const { data, error } =
        await $trpc.org.mail.emailIdentities.external.checkExternalAvailability.useQuery(
          {
            emailAddress: newIdentityEmailValue.value
          }
        );
      if (error) {
        newIdentityEmailValid.value = false;
        newIdentityEmailValidationMessage.value = 'Email already in use';
      }
      if (data.value?.available === true) {
        newIdentityEmailValid.value = true;
        newIdentityEmailValidationMessage.value = '';
      }
      return;
    }
    return;
  }

  watchDebounced(
    newIdentityEmailValue,
    async () => {
      await checkEmailAvailability();
    },
    {
      debounce: 500,
      maxWait: 5000
    }
  );

  async function testSmtpConnection() {
    smtpValidationLoading.value = true;
    const result =
      await $trpc.org.mail.emailIdentities.external.validateExternalSmtpCredentials.mutate(
        {
          host: smtpHost.value,
          port: Number(smtpPort.value),
          username: smtpUsername.value,
          password: smtpPassword.value,
          encryption: smtpEncryptionMethod.value || 'none',
          authMethod: smtpAuthMethod.value || 'plain'
        }
      );
    smtpValid.value = result.valid;
    smtpValidationLoading.value = false;
    return;
  }

  async function createNewEmailIdentity() {
    buttonLoading.value = true;
    buttonLabel.value = 'Creating...';
    const toast = useToast();

    const selectedTeamsPublicIds: string[] = selectedOrgTeams.value.map(
      (team) => team.publicId as string
    );
    const selectedOrgMembersPublicIds: string[] = selectedOrgMembers.value.map(
      (member) => member.publicId as string
    );
    const createNewExternalEmailIdentityTrpc =
      $trpc.org.mail.emailIdentities.external.createNewExternalIdentity.useMutation();
    await createNewExternalEmailIdentityTrpc.mutate({
      emailAddress: newIdentityEmailValue.value,
      sendName: newIdentitySendNameValue.value,
      smtp: {
        host: smtpHost.value,
        port: Number(smtpPort.value),
        username: smtpUsername.value,
        password: smtpPassword.value,
        encryption: smtpEncryptionMethod.value || 'none',
        authMethod: smtpAuthMethod.value || 'plain'
      },
      routeToTeamsPublicIds: selectedTeamsPublicIds,
      routeToOrgMemberPublicIds: selectedOrgMembersPublicIds
    });
    if (createNewExternalEmailIdentityTrpc.status.value === 'error') {
      buttonLoading.value = false;
      buttonLabel.value = 'Create New Email Address';
      toast.add({
        id: 'email_add_fail',
        title: 'Email Creation Failed',
        description: `${newIdentityEmailValue.value} email address could not be created.`,
        color: 'red',
        icon: 'i-ph-warning-circle',
        timeout: 5000
      });
      return;
    }
    buttonLoading.value = false;
    buttonLabel.value = 'Done... Redirecting';
    toast.add({
      id: 'address_added',
      title: 'Address Added',
      description: `${newIdentityEmailValue.value} has been added successfully.`,
      icon: 'i-ph-thumbs-up',
      timeout: 5000
    });

    emit('close');
  }

  const multipleDestinationsSelected = computed(() => {
    return selectedOrgTeams.value.length + selectedOrgMembers.value.length > 1;
  });

  function openInternalIdentity() {
    emit('openInternal');
    emit('close');
  }
  const eeStore = useEEStore();
  const { isPro } = storeToRefs(eeStore);
</script>

<template>
  <div class="flex h-full w-full flex-col items-start gap-8 overflow-y-auto">
    <div class="flex w-full flex-col gap-8">
      <div class="flex w-full flex-col gap-4">
        <div class="border-b-1 border-base-6 w-full">
          <span class="text-base-11 text-sm font-medium uppercase">
            Email Address
          </span>
        </div>

        <div class="items-top grid grid-cols-2 gap-4">
          <UnUiInput
            v-model:value="newIdentityEmailValue"
            v-model:valid="newIdentityEmailValid"
            :validation-message="newIdentityEmailValidationMessage"
            :remote-validation="true"
            label="Full Email Address"
            :schema="z.string().email()"
            width="full" />

          <UnUiInput
            v-model:value="newIdentitySendNameValue"
            v-model:valid="newIdentitySendNameValid"
            label="Send Name"
            :schema="z.string().trim().min(2).max(64)"
            :helper="`The name that will appear in the 'From' field of emails sent from this address`"
            width="full" />
        </div>
      </div>
      <NuxtUiDivider />
      <div class="flex w-full flex-col justify-center gap-4">
        <div class="border-b-1 border-base-6 w-full">
          <span class="text-base-11 text-sm font-medium uppercase">
            SMTP Settings
          </span>
        </div>

        <div class="items-top grid grid-cols-2 gap-4">
          <UnUiInput
            v-model:value="smtpHost"
            v-model:valid="smtpHostValid"
            label="Host"
            :schema="z.string().includes('.').min(4).max(64)"
            width="full" />

          <UnUiInput
            v-model:value="smtpPort"
            v-model:valid="smtpPortValid"
            label="Port"
            number
            :schema="z.number()"
            width="full" />
          <UnUiInput
            v-model:value="smtpUsername"
            v-model:valid="smtpUsernameValid"
            label="Username"
            :schema="z.string().trim().min(1).max(64)"
            width="full" />
          <UnUiInput
            v-model:value="smtpPassword"
            v-model:valid="smtpPasswordValid"
            label="Password"
            :schema="z.string().trim().min(1).max(64)"
            width="full" />
          <div class="text-primary-12 flex flex-col gap-1 leading-4">
            <div>
              <label
                id="input-label-Encryption"
                class="min-w-fit text-sm font-medium">
                Encryption
              </label>
            </div>

            <NuxtUiInputMenu
              v-model="smtpEncryptionMethod"
              label="Encryption Method"
              :options="smtpEncryptionMethods" />
          </div>

          <div class="text-primary-12 flex flex-col gap-1 leading-4">
            <div>
              <label
                id="input-label-auth"
                class="min-w-fit text-sm font-medium">
                Auth Method
              </label>
            </div>
            <NuxtUiInputMenu
              v-model="smtpAuthMethod"
              label="Authentication Method"
              :options="smtpAuthMethods" />
          </div>
        </div>
        <UnUiButton
          icon="i-ph-link"
          :label="smtpValid ? 'Success... Retest' : 'Test SMTP Connection'"
          :color="smtpValid ? 'green' : 'amber'"
          :loading="smtpValidationLoading"
          :disabled="!smtpFormValid"
          block
          class="mt-2"
          @click="testSmtpConnection" />
      </div>
      <NuxtUiDivider />
      <div class="flex flex-col gap-4">
        <div class="border-b-1 border-base-6 w-full">
          <span class="text-base-11 text-sm font-medium uppercase">
            Deliver messages to
          </span>
        </div>

        <div
          class="grid-row-2 md:grid-row-1 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium">Teams</span>
            <span v-if="orgTeamPending">
              <UnUiIcon name="i-svg-spinners:3-dots-fade" /> Loading User Teams
            </span>
            <div
              v-if="!orgTeamPending"
              class="flex flex-row flex-wrap gap-4">
              <span v-if="orgTeamsData?.teams.length === 0">
                No Teams Found
              </span>
              <NuxtUiSelectMenu
                v-else
                v-model="selectedOrgTeams"
                multiple
                placeholder="Select a team"
                :options="orgUserTeams"
                class="w-full">
                <template
                  v-if="selectedOrgTeams"
                  #label>
                  <UnUiIcon
                    name="i-ph-check"
                    class="h-4 w-4" />
                  <div
                    v-if="selectedOrgTeams.length"
                    class="flex flex-wrap gap-3">
                    <div
                      v-for="(team, index) in selectedOrgTeams"
                      :key="index"
                      class="flex flex-row items-center gap-1 truncate">
                      <UnUiAvatar
                        :alt="team.name.toString()"
                        :public-id="team.publicId"
                        :avatar-timestamp="team.avatarTimestamp"
                        :type="'team'"
                        :color="team.color as UiColor"
                        size="3xs" />
                      <span>{{ team.name }}</span>
                    </div>
                  </div>
                  <span v-else>Select teams</span>
                </template>
                <template #option="{ option }">
                  <UnUiAvatar
                    :public-id="option.publicId"
                    :avatar-timestamp="option.avatarTimestamp"
                    :type="'team'"
                    :alt="option.name"
                    :color="option.color as UiColor"
                    size="3xs" />
                  {{ option.name }}
                </template>
              </NuxtUiSelectMenu>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium">Users</span>
            <span v-if="orgMembersPending">
              <UnUiIcon name="i-svg-spinners:3-dots-fade" /> Loading Users
            </span>
            <div
              v-if="!orgMembersPending"
              class="flex flex-row flex-wrap gap-4">
              <NuxtUiSelectMenu
                v-model="selectedOrgMembers"
                multiple
                placeholder="Select users"
                :options="orgMembers"
                searchable
                option-attribute="keywords"
                class="w-full">
                <template
                  v-if="selectedOrgMembers"
                  #label>
                  <UnUiIcon
                    name="i-ph-check"
                    class="h-4 w-4" />
                  <div
                    v-if="selectedOrgMembers.length"
                    class="flex flex-wrap gap-3">
                    <div
                      v-for="(member, index) in selectedOrgMembers"
                      :key="index"
                      class="flex flex-row items-center gap-1 truncate">
                      <UnUiAvatar
                        v-if="member.publicId"
                        :public-id="member.profilePublicId"
                        :alt="member.name.toString()"
                        :avatar-timestamp="member.avatarTimestamp"
                        :type="'orgMember'"
                        size="3xs" />
                      <span>{{ member.name }}</span>
                    </div>
                  </div>
                  <span v-else>Select Users</span>
                </template>
                <template #option="{ option }">
                  <UnUiAvatar
                    :public-id="option.publicId"
                    :avatar-timestamp="option.avatarTimestamp"
                    :type="'orgMember'"
                    :alt="option.name"
                    size="xs" />
                  <span>
                    {{ option.name
                    }}<span
                      v-if="option.title"
                      class="text-xs">
                      - {{ option.title }}</span
                    ></span
                  >
                </template>
              </NuxtUiSelectMenu>
            </div>
          </div>
        </div>
      </div>
      <span
        v-if="!isPro && multipleDestinationsSelected"
        class="bg-red-9 rounded p-2 text-sm font-bold text-white">
        You can only deliver messages to one single destination on your current
        plan
      </span>
      <div class="grid grid-cols-2 gap-4">
        <UnUiButton
          icon="i-ph-link"
          label="Add internal email instead"
          variant="outline"
          class="mt-2"
          @click="openInternalIdentity()" />
        <UnUiButton
          icon="i-ph-plus"
          :label="buttonLabel"
          :loading="buttonLoading"
          :disabled="!formValid"
          variant="solid"
          class="mt-2"
          @click="createNewEmailIdentity()" />
      </div>
    </div>
  </div>
</template>
