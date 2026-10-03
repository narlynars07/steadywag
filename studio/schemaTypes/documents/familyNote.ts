import {defineField, defineType} from 'sanity'
import {HeartIcon} from '@sanity/icons/Heart'

/**
 * Something one family has learned while caring for this dog. It is an observation, never advice and never an instruction,
 * and it says whether his vet directed it. Medication timing and doses do not belong here.
 */
export const familyNote = defineType({
  name: 'familyNote',
  title: 'Family observation',
  type: 'document',
  icon: HeartIcon,
  fields: [
    defineField({name: 'order', title: 'Order', type: 'number', validation: (rule) => rule.required()}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'body', title: 'What the family has noticed', type: 'text', rows: 5, validation: (rule) => rule.required()}),
    defineField({
      name: 'directedBy',
      title: 'Who directed this',
      type: 'string',
      options: {
        list: [
          {title: 'The family\'s own observation or approach, not something the vet said', value: 'family'},
          {title: 'His vet told the family to do this', value: 'vet'},
        ],
      },
      initialValue: 'family',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'askYourVet', title: 'Worth asking your own vet', type: 'string', description: 'A one-line prompt, shown under the note.'}),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Order', name: 'orderAsc', by: [{field: 'order', direction: 'asc'}]}],
  preview: {select: {title: 'title', subtitle: 'body'}},
})
