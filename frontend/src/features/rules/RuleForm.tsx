import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { RateLimitConfig } from '../../api/types'
import { Button, Field, inputClass } from '../../components/ui'
import { algorithms, defaultsFromConfig, failModes, ruleFormSchema, toCreatePayload, toUpdatePayload, type RuleFormInput, type RuleFormValues } from './ruleSchema'

interface RuleFormProps {
  mode: 'create' | 'edit'
  config?: RateLimitConfig
  existingClientIds?: string[]
  submitting?: boolean
  error?: string | null
  onCancel: () => void
  onSubmit: (payload: ReturnType<typeof toCreatePayload> | ReturnType<typeof toUpdatePayload>) => void
}

export function RuleForm({ mode, config, existingClientIds = [], submitting, error, onCancel, onSubmit }: RuleFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<RuleFormInput, unknown, RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: defaultsFromConfig(config),
  })
  const algorithm = useWatch({ control, name: 'algorithm' })
  const clientId = useWatch({ control, name: 'client_id' })
  const duplicate = mode === 'create' && existingClientIds.includes(clientId)

  useEffect(() => {
    reset(defaultsFromConfig(config))
  }, [config, reset])

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values: RuleFormValues) => onSubmit(mode === 'create' ? toCreatePayload(values) : toUpdatePayload(values)))}
    >
      <Field label="Client ID" hint={mode === 'edit' ? 'Client ID cannot be changed by the update endpoint.' : 'Used as X-API-Key in protected requests.'}>
        <input className={inputClass} disabled={mode === 'edit'} {...register('client_id')} />
        {errors.client_id ? <p className="mt-1 text-sm text-ink-100">{errors.client_id.message}</p> : null}
        {duplicate ? <p className="mt-1 text-sm text-ink-100">This client already exists. Creating will overwrite the stored config.</p> : null}
      </Field>
      <Field label="Algorithm">
        <select className={inputClass} {...register('algorithm')}>
          {algorithms.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Limit">
          <input className={inputClass} type="number" min={1} {...register('limit')} />
          {errors.limit ? <p className="mt-1 text-sm text-ink-100">{errors.limit.message}</p> : null}
        </Field>
        <Field label="Window (ms)">
          <input className={inputClass} type="number" min={1} {...register('window_ms')} />
          {errors.window_ms ? <p className="mt-1 text-sm text-ink-100">{errors.window_ms.message}</p> : null}
        </Field>
      </div>
      {algorithm === 'TOKEN_BUCKET' ? (
        <Field label="Burst capacity" hint="Token Bucket uses this as bucket capacity. Other algorithms submit the limit as capacity to match backend storage.">
          <input className={inputClass} type="number" min={1} {...register('burst_capacity')} />
          {errors.burst_capacity ? <p className="mt-1 text-sm text-ink-100">{errors.burst_capacity.message}</p> : null}
        </Field>
      ) : null}
      <Field label="Fail mode">
        <select className={inputClass} {...register('fail_mode')}>
          {failModes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>
      {error ? <p role="alert" className="text-sm text-ink-100">{error}</p> : null}
      <div className="flex justify-end gap-3 border-t border-ink-700 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting || (mode === 'edit' && !isDirty)}>
          {submitting ? 'Saving...' : mode === 'create' ? 'Create rule' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
