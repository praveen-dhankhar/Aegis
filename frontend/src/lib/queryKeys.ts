export const queryKeys = {
  health: ['health'] as const,
  prometheus: ['prometheus'] as const,
  rules: ['rules'] as const,
  rule: (clientId: string) => ['rules', clientId] as const,
}
