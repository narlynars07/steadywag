import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons/Book'

/**
 * "Theo in 60 seconds": the short story of his history, written from his records. Every claim points at the records it
 * rests on (sources), so the agent and the page can cite them. It never diagnoses and never invents a fact.
 */
export const historySummary = defineType({
  name: 'historySummary',
  title: 'History summary',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'body', title: 'Summary', type: 'text', rows: 8, validation: (rule) => rule.required()}),
    defineField({
      name: 'sources',
      title: 'Records this rests on',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'vetVisit'}, {type: 'labResult'}, {type: 'medication'}, {type: 'flareEpisode'}, {type: 'imagingStudy'}, {type: 'recordGap'}]})],
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  preview: {select: {title: 'title', subtitle: 'body'}},
})
