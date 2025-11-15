import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { Fragment } from 'react';

const options = [1, 2, 3, 4, 5];

const TimerSelect = ({ value, onChange }) => (
  <Listbox value={value} onChange={onChange}>
    <div className="relative">
      <Listbox.Button className="input flex items-center justify-between">
        <span>{value} minute{value > 1 ? 's' : ''}</span>
        <ChevronDown className="h-4 w-4" />
      </Listbox.Button>
      <Transition
        as={Fragment}
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Listbox.Options className="absolute z-10 mt-2 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => (
            <Listbox.Option
              key={option}
              value={option}
              className={({ active }) =>
                `flex cursor-pointer items-center justify-between px-4 py-2 text-sm ${
                  active ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-200' : ''
                }`
              }
            >
              {({ selected }) => (
                <>
                  <span>{option} minute{option > 1 ? 's' : ''}</span>
                  {selected && <Check className="h-4 w-4" />}
                </>
              )}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </Transition>
    </div>
  </Listbox>
);

export default TimerSelect;
