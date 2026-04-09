export interface FormInputConfig {
  name: string;
  type:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'date'
    | 'calendar'
    | 'checkbox'
    | 'textarea'
    | 'select'
    | 'file'
    | 'tel'
    | 'url'
    | 'colorpicker'
    | 'dragdrop'
    | 'dropdown'
    | 'radio'
    | 'switch'
    | 'chosenfile'
    | 'textareafield'
    | 'button'
    | 'label'
    | 'chipinput'
    | 'choosetime';
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  defaultValue?: FormInputValue;
  options?: Array<{ value: string; label: string }>;
  colorOptions?: Array<{ value: string; label: string; color: string }>;
  className?: string;
  labelClassName?: string;
  row?: number;
  col?: number;
  colSpan?: number;
  fullWidth?: boolean;
  icon?: string;
  rightIcon?: string;
  showPasswordToggle?: boolean;
  accept?: string;
  onChange?: (value: FormInputValue) => void;
  onClick?: () => void;
  searchable?: boolean;
  isMultiSelect?: boolean;
  selectionMode?: 'day' | 'month' | 'range' | 'month-range';
  downloadLink?: {
    text: string;
    icon?: string;
    onClick: () => void;
  };
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    custom?: (value: FormInputValue) => string | null;
  };
  showChipsOnRight?: boolean; // For chipinput type: show chips on the right side
  showChipsOnBottom?: boolean; // For chipinput type: show chips at the bottom (default: true)
  timeFormat?: '12' | '24'; // For choosetime type: 12-hour or 24-hour format (default: '12')
  contentClassName?: string; // For chosenfile type: className for the inner content container
  minHeight?: string; // For dragdrop/chosenfile type: minimum height of the drop zone (e.g., 'min-h-[200px]')
}

export interface GridLayoutProps {
  gridRows: number;
  gridColumns: number;
  gap?: string;
  className?: string;
  autoFullWidth?: boolean;
}

export interface FormProps {
  inputs: FormInputConfig[];
  onSubmit: (data: Record<string, FormInputValue>) => void;
  label?: string;
  submitLabel?: string;
  cancelLabel?: string;
  className?: string;
  formBackground?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  gridLayout?: GridLayoutProps;
  formId?: string;
  variant?: 'default' | 'card' | 'minimal';
  initialData?: Record<string, FormInputValue>;
  errorMessages?: Record<string, string>;
  touchedFields?: Set<string>;
  submitted?: boolean;
  customSchema?: import('zod').ZodSchema<any>;
  showErrorsByDefault?: boolean;
  onChange?: (formData: Record<string, FormInputValue>) => void;
  showFormActions?: boolean;
  submitAction?: () => void;
  cancelAction?: () => void;
  padding?: string;
  border?: string;
  showBorder?: boolean; // Control border visibility (default: true)
  showBackground?: boolean; // Control background visibility (default: true)
  actionsClassName?: string;
  version?: string;
}

export interface FormInputProps {
  input: FormInputConfig;
  value: FormInputValue;
  error: string | undefined;
  showError: boolean;
  disabled: boolean;
  onInputChange: (name: string, value: FormInputValue, config: FormInputConfig) => void;
  onInputBlur: (name: string, value: FormInputValue, config: FormInputConfig) => void;
  fileInputRefs: React.MutableRefObject<{
    [key: string]: HTMLInputElement | null;
  }>;
  labelClassName?: string;
}

export type FormInputEvent =
  | React.ChangeEvent<HTMLInputElement>
  | React.ChangeEvent<HTMLTextAreaElement>
  | React.ChangeEvent<HTMLSelectElement>;

export type FormBlurEvent =
  | React.FocusEvent<HTMLInputElement>
  | React.FocusEvent<HTMLTextAreaElement>
  | React.FocusEvent<HTMLSelectElement>;

export type FormInputValue =
  | string
  | string[]
  | number
  | boolean
  | FileList
  | File
  | null
  | undefined;

export interface TypedFormHandlers {
  onChange: (event: FormInputEvent) => void;
}

export interface CommonInputProps {
  id: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  className: string;
  onChange: (event: FormInputEvent) => void;
  'aria-invalid'?: 'true' | 'false';
  'aria-describedby'?: string;
  'aria-required'?: 'true' | 'false';
}

export type EventValueExtractor = (event: FormInputEvent | FormBlurEvent) => FormInputValue;

export interface FormRef {
  getFormValues: () => Record<string, FormInputValue>;
  getValidationErrors: () => Record<string, string>;
  hasErrors: () => boolean;
  submit: () => void;
  reset: () => void;
  validate: () => { success: boolean; errors: Record<string, string> };
}
