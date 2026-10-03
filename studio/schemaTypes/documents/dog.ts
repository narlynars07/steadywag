import {defineField, defineType} from 'sanity'
import {HeartIcon} from '@sanity/icons/Heart'

export const dog = defineType({
  name: 'dog',
  title: 'Dog',
  type: 'document',
  icon: HeartIcon,
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'breed', title: 'Breed', type: 'string'}),
    defineField({
      name: 'sex',
      title: 'Sex',
      type: 'string',
      options: {list: ['male', 'female'], layout: 'radio'},
    }),
    defineField({
      name: 'neutered',
      title: 'Spayed or neutered',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'birthYear',
      title: 'Birth year',
      type: 'number',
      validation: (rule) => rule.integer().min(2000).max(2100),
    }),
    defineField({
      name: 'conditions',
      title: 'Conditions',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'condition'}]}],
    }),
    defineField({
      name: 'about',
      title: 'About',
      type: 'text',
      rows: 3,
      description: 'Short, de-identified description. No owner, address, or clinic details.',
    }),
  ],
  preview: {select: {title: 'name', subtitle: 'breed'}},
})
