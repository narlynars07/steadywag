import {defineField, defineType} from 'sanity'
import {BasketIcon} from '@sanity/icons/Basket'

export const foodItem = defineType({
  name: 'foodItem',
  title: 'Food',
  type: 'document',
  icon: BasketIcon,
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: ['protein', 'organ meat', 'carbohydrate', 'vegetable', 'dairy', 'treat', 'supplement', 'other'],
      },
    }),
    defineField({name: 'kcalPer100g', title: 'Calories per 100 g', type: 'number'}),
    defineField({name: 'proteinGPer100g', title: 'Protein (g per 100 g)', type: 'number'}),
    defineField({name: 'fatGPer100g', title: 'Fat (g per 100 g)', type: 'number'}),
    defineField({name: 'carbGPer100g', title: 'Carbohydrate (g per 100 g)', type: 'number'}),
    defineField({name: 'copperMgPer100g', title: 'Copper (mg per 100 g)', type: 'number'}),
    defineField({
      name: 'role',
      title: 'Role in the diet plan',
      type: 'string',
      options: {
        list: [
          {title: 'Recipe ingredient', value: 'recipe-ingredient'},
          {title: 'Approved treat', value: 'approved-treat'},
          {title: 'Avoid', value: 'avoid'},
          {title: 'Records disagree, needs confirmation', value: 'conflict'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'servingDescription',
      title: 'Plan serving',
      type: 'string',
      description: 'For approved treats, the serving size the nutrition consult gives.',
    }),
    defineField({name: 'servingKcal', title: 'Calories in that serving', type: 'number'}),
    defineField({
      name: 'avoidReason',
      title: 'Why to avoid',
      type: 'text',
      rows: 2,
      description: 'For foods marked Avoid, the reason as documented.',
    }),
    defineField({
      name: 'inCurrentPlan',
      title: 'In the current vet-approved plan',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'dataSource',
      title: 'Nutrient data source',
      type: 'string',
      description: 'For example USDA FoodData Central. Required before the value is trusted.',
    }),
    defineField({
      name: 'verified',
      title: 'Nutrient values checked against the source',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({name: 'note', title: 'Note', type: 'text', rows: 2}),
    defineField({
      name: 'source',
      title: 'Source',
      type: 'sourceNote',
      description: 'Which document puts this food in (or out of) his plan. Separate from the nutrient data source above.',
    }),
  ],
  preview: {select: {title: 'name', subtitle: 'category'}},
})
