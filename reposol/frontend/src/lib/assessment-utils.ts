import { Control, Part } from './types/oscal';

export const extractAssessmentMethods = (controlObject: Control) => {
  const methods: { id: string; method: string; prose?: string }[] = [];
  const traverse = (part: Part) => {
    const partName = part.name?.toLowerCase();
    if (partName === 'objective') {
      if (part.parts) {
        part.parts.forEach((sub: Part) => {
          const subName = sub.name?.toLowerCase();
          if (subName === 'method' || ['examine', 'interview', 'test'].includes(subName || '')) {
            const methodVal = sub.props?.find((p: any) => typeof p.name === 'string' && p.name.toLowerCase() === 'method')?.value || sub.name;
            methods.push({
              id: sub.id || `${controlObject.id}_obj.${methodVal.toLowerCase()}`,
              method: methodVal,
              prose: sub.prose
            });
          }
        });
      }
    }
    if (partName === 'assessment-method' || ['examine', 'interview', 'test'].includes(partName || '')) {
      const methodVal = part.props?.find((p: any) => typeof p.name === 'string' && p.name.toLowerCase() === 'method')?.value || part.name;
      methods.push({
        id: part.id || `${controlObject.id}_obj.${methodVal.toLowerCase()}`,
        method: methodVal,
        prose: part.prose
      });
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  };
  if (controlObject.parts) {
    controlObject.parts.forEach(traverse);
  }
  return methods;
};

export const formatMethodId = (ctrlId: string, methodName: string): string => {
  let paddedId = ctrlId.toUpperCase();
  const match = ctrlId.match(/^([a-zA-Z]+)-([0-9]+)$/);
  if (match) {
    const num = parseInt(match[2], 10);
    if (num < 10) {
      paddedId = `${match[1].toUpperCase()}-0${num}`;
    }
  }
  const capMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1).toLowerCase();
  return `${paddedId}-${capMethod}`;
};
