import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons/Book'

/** Something his records show more than once. Timing patterns are labeled "Timing only. The records don't show cause." */
export const historyPattern = defineType({
  name: 'historyPattern',
  title: 'History pattern',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({name: 'order', title: 'Order', type: 'number', validation: (rule) => rule.required()}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'body', title: 'What the records show', type: 'text', rows: 5, validation: (rule) => rule.required()}),
    defineField({name: 'timingOnly', title: 'Timing only', type: 'boolean', initialValue: false, description: 'Shows "Timing only. The records don\'t show cause."'}),
    defineField({
      name: 'sources',
      title: 'Records this rests on',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'vetVisit'}, {type: 'labResult'}, {type: 'medication'}, {type: 'flareEpisode'}, {type: 'imagingStudy'}, {type: 'recordGap'}]})],
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Order', name: 'orderAsc', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'title', subtitle: 'body'}},
})
