import {defineField, defineType} from 'sanity'

/**
 * Where a fact came from. Points at a kind of document and its date, never at
 * a file or a person, so records stay de-identified.
 */
export const sourceNote = defineType({
  name: 'sourceNote',
  title: 'Source',
  type: 'object',
  fields: [
    defineField({
      name: 'documentType',
      title: 'Document type',
      type: 'string',
      options: {
        list: [
          {title: 'Specialist discharge report', value: 'discharge-report'},
          {title: 'Lab report', value: 'lab-report'},
          {title: 'Radiology report', value: 'radiology-report'},
          {title: 'Nutrition consult', value: 'nutrition-consult'},
          {title: 'Owner notes', value: 'owner-notes'},
          {title: 'Family recall (what the family remembers, not a medical record)', value: 'family-recall'},
          {title: 'Published guidance', value: 'published-guidance'},
        ],
      },
    }),
    defineField({name: 'documentDate', title: 'Document date', type: 'date'}),
    defineField({
      name: 'confidence',
      title: 'Confidence',
      type: 'string',
      description: 'Use "conflicting" when records disagree and a person must confirm.',
      options: {
        list: [
          {title: 'Confirmed by signed vet document', value: 'confirmed'},
          {title: 'Single source, not cross-checked', value: 'single-source'},
          {title: 'Conflicting records, needs confirmation', value: 'conflicting'},
        ],
        layout: 'radio',
      },
      initialValue: 'single-source',
    }),
    defineField({
      name: 'note',
      title: 'Note',
      type: 'text',
      rows: 2,
      description: 'For example, why a conflict exists.',
    }),
  ],
  preview: {
    select: {title: 'documentType', subtitle: 'documentDate'},
  },
})
