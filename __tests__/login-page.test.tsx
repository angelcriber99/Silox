import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LoginPage from '@/app/(public)/login/page'

describe('Login page', () => {
  it('exposes labelled authentication controls and toggles password visibility', () => {
    render(<LoginPage />)

    const email = screen.getByLabelText('Correo electrónico')
    const password = screen.getByLabelText('Contraseña')
    const submit = screen.getByRole('button', { name: 'Iniciar sesión' })

    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toHaveAttribute('type', 'password')
    expect(submit).toBeDisabled()

    fireEvent.change(email, { target: { value: 'user@example.com' } })
    fireEvent.change(password, { target: { value: 'secret' } })
    expect(submit).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true')
  })
})

