'use client';

import * as React from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectValueProps {
  placeholder?: string;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const SelectContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

function Select({ value, onValueChange, children }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <Listbox value={value} onChange={onValueChange}>
        <div className="relative">
          {children}
        </div>
      </Listbox>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ children, className }: SelectTriggerProps) {
  return (
    <Listbox.Button
      className={clsx(
        'relative w-full cursor-default rounded-md py-2 pl-3 pr-10 text-left',
        'focus:outline-none focus:ring-2 focus:ring-primary-500',
        'sm:text-sm',
        className
      )}
    >
      {children}
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <ChevronUpDownIcon
          className="h-5 w-5"
          aria-hidden="true"
        />
      </span>
    </Listbox.Button>
  );
}

function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = React.useContext(SelectContext);
  return <span className="block truncate">{value || placeholder}</span>;
}

function SelectContent({ children, className }: SelectContentProps) {
  return (
    <Transition
      enter="transition ease-out duration-200"
      enterFrom="opacity-0 -translate-y-1"
      enterTo="opacity-100 translate-y-0"
      leave="transition ease-in duration-150"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 -translate-y-1"
    >
      <Listbox.Options
        className={clsx(
          'absolute z-50 mt-2 w-full max-h-60 overflow-y-auto rounded-lg',
          'py-1 text-base shadow-2xl',
          'focus:outline-none',
          className
        )}
      >
        {children}
      </Listbox.Options>
    </Transition>
  );
}

function SelectItem({ value, children, className }: SelectItemProps) {
  return (
    <Listbox.Option
      className={({ active }) =>
        clsx(
          'relative cursor-pointer select-none py-2 pl-10 pr-4',
          className
        )
      }
      value={value}
    >
      {({ selected }) => (
        <>
          <span className={clsx('block', selected ? 'font-medium' : 'font-normal')}>
            {children}
          </span>
          {selected && (
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <CheckIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
        </>
      )}
    </Listbox.Option>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
