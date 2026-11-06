'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export interface CustomSelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface CustomSelectProps {
  value: string
  options: CustomSelectOption[]
  onValueChange: (value: string) => void
  id?: string
  ariaLabel: string
  placeholder?: ReactNode
  disabled?: boolean
  className?: string
  containerClassName?: string
  menuClassName?: string
}

interface MenuPosition {
  left: number
  top: number
  width: number
  maxHeight: number
}

const MENU_ANIMATION_MS = 200

export default function CustomSelect({
  value,
  options,
  onValueChange,
  id,
  ariaLabel,
  placeholder,
  disabled = false,
  className = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-left text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500',
  containerClassName = 'w-full',
  menuClassName = '',
}: CustomSelectProps) {
  const generatedId = useId()
  const selectId = id ?? `custom-select-${generatedId}`
  const listboxId = `${selectId}-options`
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const getMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return null

    const rect = trigger.getBoundingClientRect()
    const desiredHeight = Math.min(240, options.length * 40 + 8)
    const availableBelow = Math.max(0, window.innerHeight - rect.bottom - 12)
    const availableAbove = Math.max(0, rect.top - 12)
    const placeAbove = availableBelow < Math.min(desiredHeight, 120) && availableAbove > availableBelow
    const availableHeight = placeAbove ? availableAbove : availableBelow
    const maxHeight = Math.min(desiredHeight, availableHeight)
    const width = Math.min(rect.width, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const top = placeAbove
      ? Math.max(8, rect.top - maxHeight - 4)
      : Math.min(window.innerHeight - maxHeight - 8, rect.bottom + 4)

    return { left, top, width, maxHeight }
  }, [options.length])

  const closeMenu = useCallback(() => {
    if (!isOpen && !isMounted) return
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setIsOpen(false)
    if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMounted(false)
      setMenuPosition(null)
      closeTimeoutRef.current = null
    }, MENU_ANIMATION_MS)
  }, [isMounted, isOpen])

  const openMenu = () => {
    if (disabled) return
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    const selectedIndex = options.findIndex(option => option.value === value && !option.disabled)
    const firstEnabledIndex = options.findIndex(option => !option.disabled)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(firstEnabledIndex, 0))
    setMenuPosition(getMenuPosition())
    setIsMounted(true)
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      setIsOpen(true)
      animationFrameRef.current = null
    })
  }

  useEffect(() => {
    if (!isMounted) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        closeMenu()
        return
      }
      setMenuPosition(getMenuPosition())
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (containerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      closeMenu()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [closeMenu, getMenuPosition, isMounted, isOpen])

  useEffect(() => () => {
    if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current)
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
  }, [])

  const moveActiveOption = (direction: 1 | -1) => {
    let nextIndex = activeIndex
    for (let count = 0; count < options.length; count += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length
      if (!options[nextIndex].disabled) {
        setActiveIndex(nextIndex)
        return
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Tab') {
      closeMenu()
      return
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      closeMenu()
      return
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length > 0) {
      event.preventDefault()
      if (!isOpen) {
        openMenu()
      } else {
        moveActiveOption(event.key === 'ArrowDown' ? 1 : -1)
      }
      return
    }
    if ((event.key === 'Home' || event.key === 'End') && options.length > 0) {
      event.preventDefault()
      if (!isOpen) openMenu()
      const direction = event.key === 'Home' ? 1 : -1
      const startIndex = event.key === 'Home' ? -1 : options.length
      for (let offset = 1; offset <= options.length; offset += 1) {
        const index = (startIndex + direction * offset + options.length) % options.length
        if (!options[index].disabled) {
          setActiveIndex(index)
          break
        }
      }
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isOpen) {
        openMenu()
        return
      }
      const option = options[activeIndex]
      if (option && !option.disabled) {
        onValueChange(option.value)
        closeMenu()
      }
    }
  }

  const selectedOption = options.find(option => option.value === value)

  return (
    <>
      <div ref={containerRef} className={`relative ${containerClassName}`}>
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={isOpen ? `${listboxId}-option-${activeIndex}` : undefined}
          disabled={disabled}
          onClick={() => (isOpen ? closeMenu() : openMenu())}
          onKeyDown={handleKeyDown}
          className={`relative ${className} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className="block truncate">{selectedOption?.label ?? placeholder}</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${disabled ? 'text-gray-300' : ''}`}
          />
        </button>
      </div>
      {isMounted && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          aria-hidden={!isOpen}
          className={`fixed z-[100] overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white py-1 shadow-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-opacity motion-reduce:duration-100 ${
            isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
          } ${menuClassName}`}
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={value === option.value}
              aria-disabled={!!option.disabled}
              onMouseEnter={() => !option.disabled && setActiveIndex(index)}
              onClick={() => {
                if (option.disabled) return
                onValueChange(option.value)
                closeMenu()
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${
                option.disabled
                  ? 'cursor-not-allowed text-gray-400'
                  : activeIndex === index
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
