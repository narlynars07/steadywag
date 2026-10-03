import {defineField, defineType} from 'sanity'
import {ClockIcon} from '@sanity/icons/Clock'

/**
 * One diet from the history a family gives researchers and vets: what a dog ate, from when to when.
 * Kept apart from dietRule and foodItem on purpose. Those are his current plan and its rules; this is
 * what he ate before and around diagnosis, and most of it is family recall, not a medical finding.
 * The `origin` field and the source note say which, so nothing recalled is mistaken for a record.
 */
export const dietHistoryEntry = defineType({
  name: 'dietHistoryEntry',
  title: 'Diet history entry',
  type: 'document',
  icon: ClockIcon,
  fields: [
    defineField({name: 'order', title: 'Order (oldest first)', type: 'number', validation: (rule) => rule.required()}),
    defineField({
      name: 'section',
      title: 'Section',
      type: 'string',
      options: {
        list: [
          {title: 'Adult diet', value: 'adult'},
          {title: 'Treat', value: 'treat'},
          {title: 'Chew', value: 'chew'},
          {title: 'Puppy diet', value: 'puppy'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'dietType', title: 'Type', type: 'string', description: 'Dry, canned, home-cooked, raw, or "not stated".'}),
    defineField({name: 'brand', title: 'Brand and product', type: 'string'}),
    defineField({name: 'formula', title: 'Formula, flavor or ingredients', type: 'text', rows: 3}),
    defineField({name: 'startedOn', title: 'Started', type: 'string', description: 'As written, for example "June 2021".'}),
    defineField({name: 'endedOn', title: 'Stopped, or how long fed', type: 'string'}),
    defineField({
      name: 'origin',
      title: 'Where this comes from',
      type: 'string',
      options: {
        list: [
          {title: 'Family recall (what the family remembers)', value: 'family-recall'},
          {title: 'Medical record (a document states it)', value: 'medical-record'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'beforeDiagnosis', title: 'Before the March 2023 diagnosis', type: 'boolean', initialValue: false}),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Oldest first', name: 'orderAsc', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'brand', subtitle: 'startedOn'}, prepare: ({title, subtitle}) => ({title: title ?? 'Diet history entry', subtitle})},
})
