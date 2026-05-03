import React, { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PartySplash } from '../../src/components';

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

export default function PartyIntroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const target = next === 'home' ? '/(tabs)/home' : '/session/scoreboard';

  const finishSplash = useCallback(() => {
    logPartyFlow('party-intro onFinish replace target', { target });
    router.replace(target);
  }, [router, target]);

  React.useEffect(() => {
    logPartyFlow('party-intro mounted');
    return () => logPartyFlow('party-intro unmounted');
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <PartySplash duration={3600} onFinish={finishSplash} />
    </>
  );
}
