
/**
 * Form Typing
 */

// Specifies the layout of a user form
export type FormSchema = TitledItem & {
  fields: FieldSchema[];
}

// Specifies a field within a larger form
export type FieldSchema =
  StringFieldSchema 
| LocationFieldSchema 
| DateFieldSchema 
| OptionsFieldSchema;

// The output of a completed form
export type FormInput = Dict<string, unknown>;

// The different types of input fields
export type FieldType = StringFieldType | DateFieldType | LocationFieldType | OptionsFieldType;

type StringFieldType = 'name' | 'text' | 'email';

type DateFieldType = 'date' | 'time';

type IntervalFieldType = 'interval' | 'future-interval';

type LocationFieldType = 'location';

type OptionsFieldType = 'options';

interface TitledItem {
  id: string;
  title: string;
  subtitle?: string;
}

export type Dict<K extends string, V> = {
  [key in K]: V;
}

// Field Schema Typing

type TypedField<TypeOfField, TypeOfValue> = TitledItem & {
  type: TypeOfField
} & {
  optional?: boolean;
  defaultValue?: TypeOfValue;
}

export type StringFieldSchema = TypedField<StringFieldType, string> & {
  maxLength?: number;
}

export type LocationFieldSchema = TypedField<LocationFieldType, Location>;

export type DateFieldSchema = TypedField<DateFieldType, Date> & {
  futureOnly?: boolean
};

export type OptionsFieldSchema = TypedField<OptionsFieldType, string> & {
  options: Option[];
};

export type Option = TitledItem & {
  hiddenFields?: FieldSchema[];
}

/**
 * Form Input Validation
 */

/**
 * Are the given {@code values} valid inputs given the {@code spec}?
 * @param spec the form schema
 * @param values a map from field ids to values
 * @returns a boolean
 */
export function validFormInput(spec: FormSchema, values: FormInput): boolean {
  return validFormFieldInputs(spec.fields, values);
}

function validFormFieldInputs(fields: FieldSchema[], values: FormInput): boolean {
  for (let field of fields) {
    if (!values[field.id]) {
      if (field.optional) {
        continue;
      } else {
        console.log('missing field ' + field.id)
        return false;
      }
    }
    if (!validFormFieldInput(field, values)) {
      console.log('invalid field: ' + field.id)
      return false;
    }
  }
  return true;
}

// TODO: add missing validation checks for field types
function validFormFieldInput(spec: FieldSchema, values: FormInput) {
  const value: unknown = values[spec.id];
  switch (spec.type) {
    case 'name':
      return isString(value);
    case 'text':
      return isString(value);
    case 'email':
      return isString(value) && /hhh/.test(value as string);
    case 'date':
      return isDate(value);
    case 'time':
      return isDate(value);
    //case 'future-time':
    //  return isDate(value) && value as Date > new Date();
    case 'location':
      // TODO: put some real validation here!
      return true;
    case 'options':
      if (!isString(value)) {
        return false;
      }
      for (let option of spec.options) {
        if (option.id == value) {
          return !option.hiddenFields || validFormFieldInputs(option.hiddenFields, values);
        }
      }
      return false;
  }
}

function isString(value: unknown): boolean {
  return typeof value === 'string' || value instanceof String;
}

function isDate(value: unknown) {
  return value instanceof Date;
}