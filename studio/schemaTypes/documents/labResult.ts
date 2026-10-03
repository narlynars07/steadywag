import {defineField, defineType} from 'sanity'
import {ChartUpwardIcon} from '@sanity/icons/ChartUpward'

export const labResult = defineType({
  name: 'labResult',
  title: 'Lab result',
  type: 'document',
  icon: ChartUpwardIcon,
  fields: [
    defineField({name: 'date', title: 'Date collected', type: 'date', validation: (rule) => rule.required()}),
    defineField({
      name: 'test',
      title: 'Test',
      type: 'reference',
      to: [{type: 'labTest'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'value',
      title: 'Value',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'qualifier',
      title: 'Qualifier',
      type: 'string',
      description: 'For results reported as "greater than" or "less than", such as >1000.',
      options: {
        list: [
          {title: 'Exact', value: 'exact'},
          {title: 'Greater than', value: 'gt'},
          {title: 'Less than', value: 'lt'},
        ],
        layout: 'radio',
      },
      initialValue: 'exact',
    }),
    defineField({name: 'unit', title: 'Unit', type: 'string'}),
    defineField({
      name: 'flag',
      title: 'Flag from the lab',
      type: 'string',
      options: {
        list: [
          {title: 'In range', value: 'normal'},
          {title: 'High', value: 'high'},
          {title: 'Low', value: 'low'},
        ],
        layout: 'radio',
      },
    }),
    defineField({name: 'refLow', title: 'Reference low', type: 'number'}),
    defineField({name: 'refHigh', title: 'Reference high', type: 'number'}),
    defineField({name: 'panel', title: 'Panel', type: 'string'}),
    defineField({
      name: 'visit',
      title: 'Visit',
      type: 'reference',
      to: [{type: 'vetVisit'}],
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [
    {
      title: 'Date, newest first',
      name: 'dateDesc',
      by: [{field: 'date', direction: 'desc'}],
    },
  ],
  preview: {
    select: {code: 'test.code', value: 'value', unit: 'unit', date: 'date', flag: 'flag'},
    prepare: ({code, value, unit, date, flag}) => ({
      title: `${code ?? 'Test'}: ${value ?? ''} ${unit ?? ''}`.trim(),
      subtitle: [date, flag && flag !== 'normal' ? flag : null].filter(Boolean).join(' · '),
    }),
  },
})
