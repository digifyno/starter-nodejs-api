export const WRITE_RATE_LIMIT = { max: 30, timeWindow: '1 minute' } as const

export const itemNameProperty = { type: 'string', maxLength: 255 } as const
export const itemPriceProperty = { type: 'number', minimum: 0 } as const

export const baseItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'price'],
  properties: {
    name: itemNameProperty,
    price: itemPriceProperty
  }
} as const
