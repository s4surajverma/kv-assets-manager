export function FormField({ label, name, register, errors, type = 'text', required, helperText, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        {...register(name)}
        className={`w-full border rounded-lg px-4 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white ${
          errors?.[name] ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
        }`}
        {...rest}
      />
      {helperText && !errors?.[name] && <p className="text-xs text-gray-400 mt-0.5">{helperText}</p>}
      {errors?.[name] && <p className="text-xs text-red-500 mt-0.5">{errors[name].message}</p>}
    </div>
  );
}

export function SelectField({ label, name, register, errors, options, required, placeholder, helperText, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        {...register(name)}
        className={`w-full border rounded-lg px-4 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white ${
          errors?.[name] ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
        }`}
        {...rest}
      >
        <option value="">{placeholder || '-- Select --'}</option>
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && !errors?.[name] && <p className="text-xs text-gray-400 mt-0.5">{helperText}</p>}
      {errors?.[name] && <p className="text-xs text-red-500 mt-0.5">{errors[name].message}</p>}
    </div>
  );
}

export function TextArea({ label, name, register, errors, required, helperText, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        {...register(name)}
        rows={3}
        className={`w-full border rounded-lg px-4 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white ${
          errors?.[name] ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
        }`}
        {...rest}
      />
      {helperText && !errors?.[name] && <p className="text-xs text-gray-400 mt-0.5">{helperText}</p>}
      {errors?.[name] && <p className="text-xs text-red-500 mt-0.5">{errors[name].message}</p>}
    </div>
  );
}
