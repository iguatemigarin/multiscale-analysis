declare const viewMode: HTMLSelectElement;
declare const visualScaleGrading: HTMLSelectElement;

// The renderer reads these selects on every frame, so assigning `.value` is
// enough for a binding to take effect.
const bindings: Record<string, () => void> = {
  '1': () => { viewMode.value = 'averages'; },
  '2': () => { viewMode.value = 'parentAvg'; },
  '3': () => { visualScaleGrading.value = 'mono'; },
  '4': () => { visualScaleGrading.value = 'color'; },
};

export const registerKeyboardControls = (): void => {
  window.addEventListener('keydown', (event) => {
    // Leave browser and OS shortcuts alone (Cmd+1 switches tabs, etc.)
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const binding = bindings[event.key];
    if (!binding) return;

    binding();
    event.preventDefault();
  });
};
