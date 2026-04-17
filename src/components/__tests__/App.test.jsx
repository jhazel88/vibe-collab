import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../../App'

describe('App', () => {
  it('renders the project name', () => {
    render(<App />)
    expect(screen.getByText('vibe-collab')).toBeInTheDocument()
  })

  it('increments the vibe counter', () => {
    render(<App />)
    const button = screen.getByRole('button', { name: /vibes: 0/i })
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: /vibes: 1/i })).toBeInTheDocument()
  })
})
