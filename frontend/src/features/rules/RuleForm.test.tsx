import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RuleForm } from './RuleForm'

describe('RuleForm', () => {
  it('shows token bucket burst capacity and submits valid payload', async () => {
    const onSubmit = vi.fn()
    render(<RuleForm mode="create" submitting={false} onCancel={() => undefined} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/Client ID/i), 'client-a')
    await userEvent.selectOptions(screen.getByLabelText(/Algorithm/i), 'TOKEN_BUCKET')
    await userEvent.clear(screen.getByLabelText(/^Limit/i))
    await userEvent.type(screen.getByLabelText(/^Limit/i), '5')
    await userEvent.clear(screen.getByLabelText(/Window/i))
    await userEvent.type(screen.getByLabelText(/Window/i), '1000')
    await userEvent.clear(screen.getByLabelText(/Burst capacity/i))
    await userEvent.type(screen.getByLabelText(/Burst capacity/i), '10')
    await userEvent.click(screen.getByRole('button', { name: /Create rule/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-a', algorithm: 'TOKEN_BUCKET', burst_capacity: 10 }))
  })
})
