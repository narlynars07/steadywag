import {defineField, defineType} from 'sanity'
import {HelpCircleIcon} from '@sanity/icons/HelpCircle'

/** A question to bring to the next vet visit. This is how the app turns open issues into conversations. */
export const vetQuestion = defineType({
  name: 'vetQuestion',
  title: 'Question for the vet',
  type: 'document',
  icon: HelpCircleIcon,
  fields: [
    defineField({name: 'question', title: 'Question', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'why',
      title: 'Why this is being asked',
      type: 'text',
      rows: 3,
      description: 'The pattern or fact from the chart that prompted it.',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Open', value: 'open'},
          {title: 'Asked', value: 'asked'},
          {title: 'Answered', value: 'answered'},
        ],
        layout: 'radio',
      },
      initialValue: 'open',
    }),
    defineField({
      name: 'condition',
      title: 'Related condition',
      type: 'reference',
      to: [{type: 'condition'}],
    }),
    defineField({
      name: 'guidance',
      title: 'Backed by guidance',
      type: 'reference',
      to: [{type: 'guidance'}],
    }),
  ],
  preview: {select: {title: 'question', subtitle: 'status'}},
})
