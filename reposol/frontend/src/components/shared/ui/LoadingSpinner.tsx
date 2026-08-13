import React from 'react';

export const LoadingSpinner = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '2rem' }}>
      <div className="spinner">Loading...</div>
      <style>{`
        .spinner {
          border: 4px solid rgba(0,0,0,0.1);
          border-left-color: #09f;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
