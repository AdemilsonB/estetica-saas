import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WizardStepperProps {
  currentStep: number
  steps: Array<{ label: string }>
}

export function WizardStepper({ currentStep, steps }: WizardStepperProps) {
  return (
    <nav aria-label="Progresso do assistente" className="w-full">
      <ol className="flex items-start justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isFuture = stepNumber > currentStep
          const isLast = index === steps.length - 1

          return (
            <li key={stepNumber} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Connector line (before) */}
                <div
                  className={cn(
                    'h-px flex-1 transition-colors',
                    index === 0 && 'invisible',
                    isCompleted || isCurrent
                      ? 'bg-primary'
                      : 'bg-border'
                  )}
                />

                {/* Step circle */}
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    isCompleted &&
                      'border-green-600 bg-green-600 text-white',
                    isCurrent &&
                      'border-primary bg-primary text-primary-foreground',
                    isFuture &&
                      'border-border bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Connector line (after) */}
                <div
                  className={cn(
                    'h-px flex-1 transition-colors',
                    isLast && 'invisible',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                />
              </div>

              {/* Step label */}
              <span
                className={cn(
                  'mt-2 hidden text-center text-xs sm:block',
                  isCurrent && 'font-semibold text-foreground',
                  isCompleted && 'text-green-700 dark:text-green-400',
                  isFuture && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
