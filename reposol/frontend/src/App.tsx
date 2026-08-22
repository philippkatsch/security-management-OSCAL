import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { masterEditEnabledAtom } from '@stores/workspaceAtoms';
import { fetchConfig } from '@lib/api';
import { router } from './router';

const queryClient = new QueryClient();

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
    <QueryClientProvider client={queryClient}>
      <ConfigLoader>
        <RouterProvider router={router} />
      </ConfigLoader>
    </QueryClientProvider>
  );
}
