import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { DocumentListPage } from './components/document/DocumentListPage';
import { DocumentEditorPage } from './components/document/DocumentEditorPage';
import { TraceabilityPage } from './components/traceability/TraceabilityPage';
import { ErrorBoundary } from './components/shared/ui/ErrorBoundary';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <Layout />
      </ErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'traceability',
        element: <TraceabilityPage />,
      },
      {
        path: ':stage',
        element: <DocumentListPage />,
      },
      {
        path: ':stage/:docId',
        element: <DocumentEditorPage />,
      },
    ],
  },
]);

