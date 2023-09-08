<script setup lang="ts">
  import { z } from 'zod';
  const { $trpc, $i18n } = useNuxtApp();

  const newButtonLoading = ref(false);
  const newButtonLabel = ref('Make my organization');
  const joinButtonLoading = ref(false);
  const joinButtonLabel = ref('Join my team');
  const pageError = ref(false);
  const orgPath = ref<'join' | 'new' | null>();

  //Form Fields
  const inviteCodePrefilled = ref(false);
  const inviteCodeValid = ref<boolean | 'remote' | null>(null);
  const inviteCodeValue = ref('');
  const inviteCodeValidationMessage = ref('');
  const orgNameValid = ref<boolean | 'remote' | null>(null);
  const orgNameValue = ref('');
  const orgNameValidationMessage = ref('');

  const username = ref('');
  if (process.client) {
    const usernameCookie = useCookie('un-join-username').value;
    usernameCookie ? (username.value = usernameCookie || '') : null;
  }

  if (process.client) {
    const inviteCodeCookie = useCookie('un-invite-code').value;
    if (inviteCodeCookie) {
      inviteCodePrefilled.value = true;
      inviteCodeValid.value = true;
      inviteCodeValue.value = inviteCodeCookie;
    }
  }
  const formValid = computed(() => {
    if (orgPath.value === 'join' && inviteCodeValid.value === true) return true;
    if (orgPath.value === 'new' && orgNameValid.value === true) return true;
  });

  //functions
  async function createNewOrg() {
    newButtonLoading.value = true;
    newButtonLabel.value = 'Creating your profile';
    const createNewOrgResponse =
      await $trpc.org.settings.createPersonalOrg.mutate({
        orgName: orgNameValue.value
      });

    if (!createNewOrgResponse.success) {
      newButtonLoading.value = false;
      pageError.value = true;
      newButtonLabel.value = 'Something went wrong!';
    }
    newButtonLoading.value = false;
    newButtonLabel.value = 'All Done!';
    navigateTo('/unboarding');
  }
  async function joinOrg() {
    //FIXME: Add code for joining an org
    //   joinButtonLoading.value = true;
    //   joinButtonLabel.value = 'Creating your profile';
    //   const createProfileResponse = await $trpc.user.profile.createProfile.mutate(
    //     {
    //       fName: fNameValue.value,
    //       lName: lNameValue.value,
    //       imageId: imageId.value || ''
    //     }
    //   );
    //   if (!createProfileResponse.success && createProfileResponse.error) {
    //     joinButtonLoading.value = false;
    //     pageError.value = true;
    //     joinButtonLabel.value = 'Something went wrong!';
    //   }
    //   joinButtonLoading.value = false;
    //   joinButtonLabel.value = 'All Done!';
    //   navigateTo('/join/org');
  }
</script>

<template>
  <div class="h-screen w-screen flex flex-col items-center justify-between p-4">
    <div
      class="max-w-72 w-full flex grow flex-col items-center justify-center gap-8 pb-14 md:max-w-xl">
      <h1 class="mb-4 text-center text-2xl font-display">
        Let's make your <br /><span class="text-5xl">UnInbox</span>
      </h1>
      <h2 class="text-center text-xl font-semibold">
        Set up your organization
      </h2>
      <div class="w-full flex flex-row justify-stretch gap-2">
        <UnUiTooltip
          text="Choose your username"
          parent-class="w-full">
          <div
            class="h-2 w-full rounded bg-primary-6"
            @click="navigateTo('/join')" />
        </UnUiTooltip>
        <UnUiTooltip
          text="Secure your account"
          parent-class="w-full">
          <div
            class="h-2 w-full rounded bg-primary-6"
            @click="navigateTo('/join/passkey')" />
        </UnUiTooltip>
        <UnUiTooltip
          text="Create your profile"
          parent-class="w-full">
          <div
            class="h-2 w-full rounded bg-primary-6"
            @click="navigateTo('/join/profile')" />
        </UnUiTooltip>
        <UnUiTooltip
          text="Set up your organization"
          parent-class="w-full">
          <div
            class="h-2 w-full rounded bg-primary-9"
            @click="navigateTo('/join/org')" />
        </UnUiTooltip>
      </div>

      <div class="flex flex-col gap-2">
        <p class="text-center">
          Organizations can share conversations between members, add custom
          domains, and configure email routing & settings.
        </p>
        <p class="text-center text-sm">
          Tip: You can be a member of multiple organizations, and choose if you
          want to see all conversations in one place, or view each organization
          separately.
        </p>
      </div>
      <div class="grid grid-cols-2 content-center items-center gap-4">
        <div
          class="aspect-square w-[128px] cursor-pointer border-1 border-base-7 rounded-6 bg-base-3 p-4 text-center hover:(border-primary-8 bg-primary-4)"
          :class="
            orgPath === 'new' ? 'bg-primary-5 border-primary-8' : 'bg-base-3'
          "
          @click="orgPath = 'new'">
          <p class="m-auto font-display">Make a new organization</p>
        </div>
        <div
          class="aspect-square w-[128px] cursor-pointer border-1 border-base-7 rounded-6 bg-base-3 p-4 text-center hover:(border-primary-8 bg-primary-4)"
          :class="
            orgPath === 'join' ? 'bg-primary-5 border-primary-8' : 'bg-base-3'
          "
          @click="orgPath = 'join'">
          <p class="m-auto font-display">My team is already here</p>
        </div>
      </div>

      <div
        v-if="orgPath === 'new'"
        class="w-full flex flex-col gap-8">
        <UnUiInput
          v-model:value="orgNameValue"
          v-model:valid="orgNameValid"
          v-model:validationMessage="orgNameValidationMessage"
          width="full"
          label="Organization Name"
          placeholder=""
          :schema="z.string()" />

        <UnUiButton
          :label="newButtonLabel"
          icon="ph-house"
          :loading="newButtonLoading"
          :disabled="!formValid"
          width="full"
          @click="createNewOrg()" />
      </div>
      <div
        v-if="orgPath === 'join'"
        class="w-full flex flex-col gap-8">
        <div class="flex flex-col gap-2">
          <UnUiInput
            v-model:value="inviteCodeValue"
            v-model:valid="inviteCodeValid"
            v-model:validationMessage="inviteCodeValidationMessage"
            width="full"
            label="Invite Code"
            placeholder=""
            :schema="z.string().min(10).max(32)" />
          <p
            v-if="inviteCodePrefilled"
            class="text-sm">
            We detected your invite code, you're good to go
          </p>
        </div>

        <UnUiButton
          :label="joinButtonLabel"
          icon="ph-users-four"
          :loading="joinButtonLoading"
          :disabled="!formValid"
          width="full"
          @click="joinOrg()" />
      </div>
      <p
        v-if="pageError"
        class="w-full rounded bg-red-9 p-4 text-center">
        Something went wrong, please try again or contact our support team if it
        persists
      </p>
    </div>
  </div>
</template>