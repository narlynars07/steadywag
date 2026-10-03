import {defineArrayMember, defineField, defineType} from 'sanity'
import {ClipboardIcon} from '@sanity/icons/Clipboard'

/**
 * A rule from the vet's or nutritionist's documented diet plan. The food
 * checker compares foods against these. It does not invent new rules.
 */
export const dietRule = defineType({
  name: 'dietRule',
  title: 'Diet rule',
  type: 'document',
  icon: ClipboardIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          {title: 'Limit', value: 'limit'},
          {title: 'Avoid', value: 'avoid'},
          {title: 'Prefer', value: 'prefer'},
          {title: 'Keep consistent', value: 'consistency'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'nutrient',
      title: 'Nutrient or topic',
      type: 'string',
      options: {
        list: [
          {title: 'Copper', value: 'copper'},
          {title: 'Fat', value: 'fat'},
          {title: 'Protein', value: 'protein'},
          {title: 'Purines', value: 'purines'},
          {title: 'Calories', value: 'calories'},
          {title: 'Other', value: 'other'},
        ],
      },
    }),
    defineField({name: 'rule', title: 'Rule', type: 'text', rows: 3, validation: (rule) => rule.required()}),
    defineField({
      name: 'rationale',
      title: 'Why, as documented',
      type: 'text',
      rows: 3,
      description: 'The reasoning from the nutrition consult, in your own words.',
    }),
    defineField({
      name: 'setBy',
      title: 'Set by',
      type: 'string',
      options: {
        list: [
          {title: 'Veterinary nutritionist', value: 'nutritionist'},
          {title: 'Specialist vet', value: 'specialist'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'conditions',
      title: 'Related conditions',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'condition'}]})],
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  preview: {select: {title: 'title', subtitle: 'nutrient'}},
})
