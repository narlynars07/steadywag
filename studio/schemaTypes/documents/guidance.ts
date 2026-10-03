import {defineArrayMember, defineField, defineType} from 'sanity'
import {BookIcon} from '@sanity/icons/Book'

/**
 * One cited piece of veterinary guidance, summarized in our own words with a
 * link to the original. This is the content behind the Knowledge Base.
 */
export const guidance = defineType({
  name: 'guidance',
  title: 'Guidance',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'topic',
      title: 'Topic',
      type: 'string',
      options: {
        list: [
          {title: 'Diagnosis', value: 'diagnosis'},
          {title: 'Monitoring', value: 'monitoring'},
          {title: 'Treatment', value: 'treatment'},
          {title: 'Nutrition', value: 'nutrition'},
          {title: 'Questions to ask the vet', value: 'vet-questions'},
          {title: 'Life stage and aging', value: 'aging'},
        ],
      },
    }),
    defineField({
      name: 'summary',
      title: 'Summary (own words)',
      type: 'text',
      rows: 4,
      description: 'Never paste copyrighted text. Summarize and link.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'keyPoints',
      title: 'Key points',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({
      name: 'applicability',
      title: 'Who the evidence is about',
      type: 'text',
      rows: 2,
      description:
        'Species, breeds and study type. Say plainly when the evidence is not about this dog\'s breed.',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'sourceTitle', title: 'Source title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'sourceUrl',
      title: 'Source link',
      type: 'url',
      validation: (rule) => rule.required().uri({scheme: ['http', 'https']}),
    }),
    defineField({name: 'publisher', title: 'Publisher', type: 'string'}),
    defineField({name: 'year', title: 'Year', type: 'number', validation: (rule) => rule.integer().min(1900).max(2100)}),
    defineField({
      name: 'evidenceType',
      title: 'Evidence type',
      type: 'string',
      options: {
        list: [
          {title: 'Consensus statement', value: 'consensus-statement'},
          {title: 'Peer-reviewed study', value: 'peer-reviewed-study'},
          {title: 'Veterinary nutrition service', value: 'nutrition-service'},
          {title: 'Clinical reference', value: 'clinical-reference'},
          {title: 'Regulator statement', value: 'regulator-statement'},
        ],
      },
    }),
    defineField({
      name: 'reviewStatus',
      title: 'Review status',
      type: 'string',
      options: {
        list: [
          {title: 'Draft, not yet checked against the source', value: 'draft'},
          {title: 'Checked against the source', value: 'checked'},
          {title: 'Reviewed by a veterinarian', value: 'vet-reviewed'},
        ],
        layout: 'radio',
      },
      initialValue: 'draft',
    }),
    defineField({
      name: 'conditions',
      title: 'Related conditions',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'condition'}]})],
    }),
  ],
  preview: {select: {title: 'title', subtitle: 'sourceTitle'}},
})
