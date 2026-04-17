import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../../App'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('HTA Tracker')).toBeInTheDocument()
  })

  it('renders the search page by default', () => {
    render(<App />)
    expect(screen.getByText('HTA Market Access Tracker')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search sponsors/i)).toBeInTheDocument()
  })
})
