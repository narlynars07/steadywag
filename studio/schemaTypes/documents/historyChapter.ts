import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons/Book'

/** One chapter of his history. The date range drives the links to its timeline entries and labs. */
export const historyChapter = defineType({
  name: 'historyChapter',
  title: 'History chapter',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({name: 'order', title: 'Order', type: 'number', validation: (rule) => rule.required()}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'dates', title: 'Dates shown', type: 'string', description: 'For example "Nov 2022 to Mar 2023".'}),
    defineField({name: 'startDate', title: 'Starts', type: 'date', validation: (rule) => rule.required()}),
    defineField({name: 'endDate', title: 'Ends', type: 'date', description: 'Leave empty for "now".'}),
    defineField({name: 'summary', title: 'Summary', type: 'text', rows: 6, validation: (rule) => rule.required()}),
    defineField({name: 'keyNumbers', title: 'Key numbers', type: 'array', of: [defineArrayMember({type: 'string'})]}),
    defineField({name: 'notInRecords', title: 'Not in the records', type: 'array', of: [defineArrayMember({type: 'string'})], description: 'Gaps in this period that stay visible.'}),
    defineField({
      name: 'sources',
      title: 'Records this rests on',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'vetVisit'}, {type: 'labResult'}, {type: 'medication'}, {type: 'flareEpisode'}, {type: 'imagingStudy'}, {type: 'recordGap'}]})],
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Order', name: 'orderAsc', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'title', subtitle: 'dates'}},
})
