import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { masterEditEnabledAtom } from '@stores/workspaceAtoms';
import { fetchConfig } from '@lib/api';
import { queryClient as globalQueryClient } from '@lib/queryClient';
import { router } from './router';

function SafeQueryClientProvider({ children }: { children: React.ReactNode }) {
  let hasClient = false;
  try {
    hasClient = !!useQueryClient();
  } catch {
    hasClient = false;
  }

  if (hasClient) {
    return <>{children}</>;
  }
  return <QueryClientProvider client={globalQueryClient}>{children}</QueryClientProvider>;
}

function ConfigLoader({ children }: { children: React.ReactNode }) {
  const setMasterEditEnabled = useSetAtom(masterEditEnabledAtom);

  useEffect(() => {
    fetchConfig().then(config => {
      setMasterEditEnabled(config.masterEditEnabled);
    });
  }, [setMasterEditEnabled]);

  return <>{children}</>;
}

export default function App() {
  return (
    <SafeQueryClientProvider>
      <ConfigLoader>
        <RouterProvider router={router} />
      </ConfigLoader>
    </SafeQueryClientProvider>
  );
}
