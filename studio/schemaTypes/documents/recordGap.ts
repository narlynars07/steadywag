import {defineArrayMember, defineField, defineType} from 'sanity'
import {SearchIcon} from '@sanity/icons/Search'

/**
 * Something the chart does not know: a visit with no report, a result never recorded,
 * an instruction no one wrote down. Showing what is missing, and where to look, is as
 * important as showing what is known.
 */
export const recordGap = defineType({
  name: 'recordGap',
  title: 'Record gap',
  type: 'document',
  icon: SearchIcon,
  fields: [
    defineField({name: 'title', title: 'What is missing', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          {title: 'Report or document not on file', value: 'missing-document'},
          {title: 'Result never recorded', value: 'missing-result'},
          {title: 'Verbal instruction never written down', value: 'verbal-instruction'},
          {title: 'Records disagree', value: 'conflict'},
        ],
      },
    }),
    defineField({name: 'why', title: 'Why it matters', type: 'text', rows: 3, validation: (rule) => rule.required()}),
    defineField({
      name: 'whereToLook',
      title: 'Where to look',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Open', value: 'open'},
          {title: 'Found', value: 'found'},
          {title: 'Cannot be recovered', value: 'unrecoverable'},
        ],
        layout: 'radio',
      },
      initialValue: 'open',
    }),
    defineField({name: 'ownerNote', title: 'What the family remembers', type: 'text', rows: 2}),
    defineField({
      name: 'condition',
      title: 'Related condition',
      type: 'reference',
      to: [{type: 'condition'}],
    }),
  ],
  preview: {select: {title: 'title', subtitle: 'status'}},
})
