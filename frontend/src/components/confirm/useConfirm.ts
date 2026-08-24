import { useContext } from 'react';
import { ConfirmContext } from './ConfirmProvider';

const useConfirmContext = () => {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }

  return context;
};

/** `if (!(await confirm({ title: 'Remove this item?' }))) return;` */
export const useConfirm = () => useConfirmContext().confirm;

/** Resolves to the chosen option, or null if the visitor backed out. */
export const usePrompt = () => useConfirmContext().prompt;
