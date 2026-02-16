import { toast } from 'sonner';
import React from 'react';
import ErrorIcon from './ErrorIcon';

export function toastSuccess(message) {
  return toast.success(message);
}

export function toastError(message) {
  return toast.error(message, { icon: React.createElement(ErrorIcon) });
}

export function toastInfo(message) {
  return toast.info(message);
}
