import React, { Suspense } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

import { LoadingSpinner } from '@components/shared/ui/LoadingSpinner';
import { ErrorBoundary } from '@components/shared/ui/ErrorBoundary';

const CatalogPage = React.lazy(() => import('../catalog/CatalogPage').then(m => ({ default: m.CatalogPage })));
const ProfilePage = React.lazy(() => import('../profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const MappingPage = React.lazy(() => import('../mapping/MappingPage').then(m => ({ default: m.MappingPage })));
const ComponentPage = React.lazy(() => import('../component-definition/ComponentPage').then(m => ({ default: m.ComponentPage })));
const SSPPage = React.lazy(() => import('../ssp/SSPPage').then(m => ({ default: m.SSPPage })));
const APPage = React.lazy(() => import('../assessment-plan/APPage').then(m => ({ default: m.APPage })));
const ARPage = React.lazy(() => import('../assessment-results/ARPage').then(m => ({ default: m.ARPage })));
const POAMPage = React.lazy(() => import('../poam/POAMPage').then(m => ({ default: m.POAMPage })));
import { TraceabilityPage } from '../traceability/TraceabilityPage';

export const DocumentEditorPage = () => {
  const { stage, docId } = useParams<{ stage: string; docId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(location.search);
  const initialEditMode = queryParams.get('edit') === 'true';
  const initialView = queryParams.get('view') || undefined;

  const handleClose = () => navigate(`/${stage}`);

  if (!stage || !docId) {
    return <div>Invalid Document URL</div>;
  }

  let content = <div>Unknown Stage: {stage}</div>;

  switch (stage) {
    case 'catalogs':
      content = <CatalogPage catalogId={docId} initialEditMode={initialEditMode} onClose={handleClose} />;
      break;
    case 'profiles':
      content = <ProfilePage profileId={docId} initialEditMode={initialEditMode} initialView={initialView} onClose={handleClose} />;
      break;
    case 'control-mappings':
    case 'mappings':
      content = <MappingPage mappingId={docId} initialEditMode={initialEditMode} onClose={handleClose} />;
      break;
    case 'component-definitions':
      content = <ComponentPage componentDefId={docId} initialEditMode={initialEditMode} onClose={handleClose} />;
      break;
    case 'ssps':
      content = <SSPPage sspId={docId} initialEditMode={initialEditMode} onClose={handleClose} />;
      break;
    case 'poams':
      content = <POAMPage poamId={docId} initialEditMode={initialEditMode} onClose={handleClose} />;
      break;
    case 'assessment-plans':
      content = <APPage apId={docId} initialEditMode={initialEditMode} onClose={handleClose} />;
      break;
    case 'assessment-results':
      content = <ARPage arId={docId} initialEditMode={initialEditMode} onClose={handleClose} />;
      break;
    case 'traceability':
      content = <TraceabilityPage />;
      break;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ErrorBoundary>
        {content}
      </ErrorBoundary>
    </Suspense>
  );
};
