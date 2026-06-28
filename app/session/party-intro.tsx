import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PartySplash } from '../../src/components';

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

export default function PartyIntroScreen() {
  const router = useRouter();

  const finishSplash = useCallback(() => {
    logPartyFlow('party-intro onFinish replace scoreboard');
    router.replace('/session/scoreboard');
  }, [router]);

  React.useEffect(() => {
    logPartyFlow('party-intro mounted');
    return () => logPartyFlow('party-intro unmounted');
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <PartySplash onFinish={finishSplash} />
    </>
  );
}
