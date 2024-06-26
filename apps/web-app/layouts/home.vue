<script setup lang="ts">
  // put in the handlers for the realtime client
  import {
    useRoute,
    useNuxtApp,
    ref,
    navigateTo,
    refreshNuxtData,
    useToast
  } from '#imports';
  import { useRealtime } from '~/composables/realtime';
  import { useConvoEntryStore } from '~/stores/convoEntryStore';
  import { useConvoStore } from '~/stores/convoStore';
  import { useHiddenConvoStore } from '~/stores/convoHiddenStore';
  import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

  const { $trpc } = useNuxtApp();
  const breakpoints = useBreakpoints(breakpointsTailwind);
  const isMobile = breakpoints.smaller('lg'); // only smaller than lg

  const orgShortcode = useRoute().params.orgShortcode;

  const convoStore = useConvoStore();
  const hiddenConvoStore = useHiddenConvoStore();
  const convoEntryStore = useConvoEntryStore();
  const showClaimEmailIdentityModal = ref(false);

  const { data: userHasEmailIdentities } =
    await $trpc.org.mail.emailIdentities.userHasEmailIdentities.useQuery(
      {},
      { server: false }
    );

  if (
    userHasEmailIdentities.value &&
    userHasEmailIdentities.value.hasIdentity === false
  ) {
    showClaimEmailIdentityModal.value = true;
  }

  const realtime = useRealtime();
  const toast = useToast();

  realtime.connect({ orgShortcode: orgShortcode as string });

  realtime.on('convo:new', async (convo) => {
    await convoStore.fetchAndAddSingleConvo({ convoPublicId: convo.publicId });
    return;
  });
  realtime.on('convo:hidden', async (convo) => {
    if (convo.hidden) {
      await convoStore.hideConvoFromList({ convoPublicId: convo.publicId });
      await hiddenConvoStore.hideHiddenConvoFromList({
        convoPublicId: convo.publicId
      });
      return;
    }
    await hiddenConvoStore.unhideHiddenConvoFromList({
      convoPublicId: convo.publicId
    });
    await convoStore.unhideConvoFromList({ convoPublicId: convo.publicId });
    return;
  });
  realtime.on('convo:deleted', async (convoEntry) => {
    convoEntryStore.removeConvo({
      convoPublicId: convoEntry.publicId
    });
    convoStore.removeConvo({
      convoPublicId: convoEntry.publicId
    });
    hiddenConvoStore.removeConvo({
      convoPublicId: convoEntry.publicId
    });

    const currentPathConvoId = useRoute().params.convoId;
    if (currentPathConvoId && currentPathConvoId === convoEntry.publicId) {
      toast.add({
        id: 'deleted_convo',
        title: 'This conversation has been deleted',
        icon: 'i-ph-trash',
        color: 'red',
        timeout: 10000
      });
      navigateTo(`/${orgShortcode}/convo/404?error=convo_deleted`);
    }
    return;
  });
  realtime.on('convo:entry:new', async (convoEntry) => {
    await convoEntryStore.addConvoSingleEntry({
      convoPublicId: convoEntry.convoPublicId,
      convoEntryPublicId: convoEntry.convoEntryPublicId
    });
    await convoStore.fetchAndAddSingleConvo({
      convoPublicId: convoEntry.convoPublicId
    });
    // refresh the convo data if it is currently open
    const currentPathConvoId = useRoute().params.convoId;
    if (currentPathConvoId && currentPathConvoId === convoEntry.convoPublicId) {
      await refreshNuxtData(`convoDetails-${convoEntry.convoPublicId}`);
    }
    return;
  });

  function navToClaimEmailIdentity() {
    showClaimEmailIdentityModal.value = false;
    navigateTo(`/${orgShortcode}/settings/user/addresses`);
  }
</script>
<template>
  <div
    class="overflow-none flex h-full max-h-full w-full flex-col items-center lg:flex-row">
    <UnUiModal
      v-model="showClaimEmailIdentityModal"
      :has-close="false"
      prevent-close>
      <template #header>
        <div class="flex flex-row items-center gap-2">
          <span class="text-red-9 text-2xl leading-none">
            <UnUiIcon
              name="i-ph-warning-octagon"
              size="xl" />
          </span>
          <span class="text-lg font-semibold leading-none">
            You don't have any email addresses
          </span>
        </div>
      </template>
      <div class="flex flex-col gap-4">
        <p>You don't have any email addresses assigned to you.</p>
        <p>Do you want to claim a free @uninbox.me email address?</p>
      </div>
      <template #footer>
        <div class="flex flex-row justify-end gap-2">
          <UnUiButton
            label="Ignore for now"
            variant="outline"
            @click="showClaimEmailIdentityModal = false" />
          <UnUiButton
            label="Claim my free address"
            @click="navToClaimEmailIdentity()" />
        </div>
      </template>
    </UnUiModal>
    <layout-navbar
      v-if="!isMobile"
      class="z-40" />
    <div
      class="bg-base-1 dark:bg-base-1 h-full max-h-full w-full overflow-hidden lg:mt-0">
      <slot />
    </div>
    <layout-mobile-nav
      v-if="isMobile"
      class="bottom-0 z-40" />
  </div>
</template>
