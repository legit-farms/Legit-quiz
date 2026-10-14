import catEggs from '../assets/cat-eggs.png'
import catOils from '../assets/cat-oils.png'
import brownEggs from '../assets/brown-eggs.jpg'
import eggYolks from '../assets/egg-yolks.webp'
import legitHens from '../assets/legit-hens.jpg'
import cagedHen from '../assets/caged-hen.jpg'
import hensCaged from '../assets/hens-caged.jpg'
import hensPasture from '../assets/hens-pasture.jpg'

// All quiz content lives here. To change a question, edit the text below.
//
// Each question:
//   text     - the question
//   media    - optional picture: { type: 'egg' }  (drawn brown egg)
//                                { type: 'image', src }  (one photo)
//                                { type: 'duo', images: [{ src, reveal }, { src, reveal }] }
//   options  - the answers, shown as a, b, c...
//   correct  - id of the right option, or null for a trick question (not scored)
//   fact     - shown after the visitor answers (use \n to start a new paragraph)
//   facts    - optional three quick facts shown as tiles: [{ label, value }]
//   legit    - the Legit Farms text shown in the green box under the fact
//   legitLine - optional big highlighted line in the green box
//   legitTags - optional small tags in the green box

export const quizzes = {
  eggs: {
    id: 'eggs',
    title: 'Eggs',
    tagline: 'How well do you know your eggs?',
    image: catEggs,
    questions: [
      {
        text: "When you buy these eggs, what do you think you're buying?",
        media: { type: 'image', src: brownEggs },
        options: [
          { id: 'desi', label: 'Desi eggs' },
          { id: 'better', label: 'Better than white eggs' },
          { id: 'brown', label: 'Just brown eggs' },
        ],
        correct: 'brown',
        fact: 'They are just brown eggs. Same as any regular egg, only the shell colour is different. They do not have more protein, but you still pay a premium for them.\nReal natural eggs come in unique colours and shapes, because real natural eggs are not factory made.',
        facts: [
          { label: 'Protein', value: 'Same' },
          { label: 'Shell', value: 'Colour only' },
          { label: 'Price', value: 'Premium' },
        ],
        legit: "Our pasture-raised eggs come in unique sizes, shapes and colours, because Legit eggs are farm made, not factory made. That's why we don't sell 'desi' eggs, 'brown' eggs or 'white' eggs.",
        legitLine: 'We sell real natural eggs.',
        legitTags: ['Pasture-raised', 'Farm made', 'No two eggs alike'],
      },
      {
        text: 'An orange yolk means a good, healthy egg?',
        media: { type: 'image', src: eggYolks },
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
          { id: 'idk', label: "I don't know" },
        ],
        correct: 'no',
        fact: 'Not always. Yolk colour comes from what the hen eats, and colour can be added through the feed. A deep orange yolk alone does not prove the egg is healthy.',
        facts: [
          { label: 'Yolk colour', value: 'From feed' },
          { label: 'Colour', value: 'Can be added' },
          { label: 'Proves health', value: 'No' },
        ],
        legit: 'The yolk colour of Legit Farms eggs comes naturally from what our hens eat on open pasture, so it can change a little from egg to egg.',
        legitLine: 'Naturally different, egg to egg.',
        legitTags: ['Pasture-raised', 'Vegetarian feed'],
      },
      {
        text: 'Are you buying just an egg, or are you also choosing how the hen is raised?',
        media: { type: 'image', src: legitHens },
        options: [
          { id: 'egg', label: 'Just an egg' },
          { id: 'hen', label: "I'm also choosing how the hen is raised" },
          { id: 'never', label: 'I never thought about it' },
        ],
        correct: 'hen',
        fact: 'Every egg comes with a choice. How the hen lives (her space, her feed, her sunlight) decides what ends up in your egg.',
        facts: [
          { label: 'Space', value: 'Room to roam' },
          { label: 'Feed', value: 'Natural diet' },
          { label: 'Light', value: 'Real sun' },
        ],
        legit: 'Legit Farms hens are 100% pasture-raised. When you choose our eggs, you also choose a better life for the hen.',
        legitLine: 'Better life for the hen. Better egg for you.',
        legitTags: ['100% pasture-raised', 'Open pasture'],
      },
      {
        text: 'Which hens lay the healthier eggs?',
        media: {
          type: 'duo',
          images: [
            { src: hensCaged, reveal: 'Caged' },
            // zoomed in from the bottom so the banner behind the hens is cropped out
            { src: hensPasture, reveal: 'Pasture-raised', zoom: 1.3, origin: 'bottom center' },
          ],
        },
        options: [
          { id: '1', label: 'Picture 1' },
          { id: '2', label: 'Picture 2' },
          { id: 'same', label: 'Both are the same' },
          { id: 'idk', label: "I don't know" },
        ],
        correct: '2',
        fact: 'Picture 2. Pasture-raised hens roam outdoors, eat a natural diet and get real sunlight. A healthier hen lays a better egg.',
        facts: [
          { label: 'Picture 1', value: 'Caged' },
          { label: 'Picture 2', value: 'Pasture' },
          { label: 'Better egg', value: 'Picture 2' },
        ],
        legit: 'Legit Farms hens live like Picture 2, outdoors and free to roam.',
        legitLine: 'Open pasture. Real sunlight. Every day.',
        legitTags: ['100% pasture-raised', 'Free to roam'],
      },
      {
        text: 'How much space does a caged hen get to live in?',
        media: { type: 'image', src: cagedHen },
        options: [
          { id: 'room', label: 'About the size of a room' },
          { id: 'garden', label: 'A small garden' },
          { id: 'a4', label: 'Less than an A4 sheet of paper' },
          { id: 'idk', label: "I don't know" },
        ],
        correct: 'a4',
        fact: 'A caged hen spends her whole life in a space smaller than an A4 sheet of paper.',
        facts: [
          { label: 'Cage space', value: '< A4 sheet' },
          { label: 'A4 sheet', value: '21 × 30 cm' },
          { label: 'Room to roam', value: 'None' },
        ],
        legit: 'Our hens roam free on open pasture, the way hens are meant to live.',
        legitLine: 'No cages at Legit Farms.',
        legitTags: ['Cage-free', '100% pasture-raised'],
      },
    ],
  },
  oils: {
    id: 'oils',
    title: 'Oils',
    tagline: 'How well do you know your cooking oil?',
    image: catOils,
    // Add the oil questions here. The card unlocks by itself once this has questions.
    questions: [],
  },
}

export const categories = [quizzes.eggs, quizzes.oils]
