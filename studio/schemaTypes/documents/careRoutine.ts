import {defineArrayMember, defineField, defineType} from 'sanity'
import {ClockIcon} from '@sanity/icons/Clock'

/**
 * The family's own daily routine (their sitter schedule): meal times, when medications are given, bedtime steps.
 * It fills in times only where his vet's written instructions give none. Where the records give timing, the records
 * win and this document never overrides them. Every document here is labeled family routine, not a vet record.
 */
export const careRoutine = defineType({
  name: 'careRoutine',
  title: 'Family routine',
  type: 'document',
  icon: ClockIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          {title: 'Meal', value: 'meal'},
          {title: 'Medications at this time', value: 'medication'},
          {title: 'Bedtime step', value: 'bedtime'},
          {title: 'Note', value: 'note'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'sortOrder', title: 'Order in the day', type: 'number', validation: (rule) => rule.required()}),
    defineField({name: 'timeLabel', title: 'Time', type: 'string', description: 'For example "about 8:30 AM, after breakfast".'}),
    defineField({name: 'detail', title: 'Detail', type: 'text', rows: 3}),
    defineField({
      name: 'items',
      title: 'Medications at this time',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'routineMedication',
          fields: [
            defineField({name: 'medication', title: 'Medication', type: 'reference', to: [{type: 'medication'}]}),
            defineField({name: 'note', title: 'Note', type: 'string'}),
          ],
          preview: {select: {title: 'medication.name', subtitle: 'note'}},
        }),
      ],
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Order in the day', name: 'orderAsc', by: [{field: 'sortOrder', direction: 'asc'}]}],
  preview: {select: {title: 'title', subtitle: 'timeLabel'}},
})
