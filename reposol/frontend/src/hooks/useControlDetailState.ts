import { useState } from 'react';

export const useControlDetailState = () => {
  const [showAdvancedPartIndex, setShowAdvancedPartIndex] = useState<Record<string, boolean>>({});

  const toggleAdvancedPart = (key: string) => {
    setShowAdvancedPartIndex(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return {
    showAdvancedPartIndex,
    toggleAdvancedPart
  };
};
