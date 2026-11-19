import globals from 'globals'
import hooks from 'eslint-plugin-react-hooks'

export default [
  {ignores:['dist/**']},
  {
    files:['src/**/*.{js,jsx}'],
    languageOptions:{globals:globals.browser,parserOptions:{ecmaFeatures:{jsx:true}}},
    plugins:{'react-hooks':hooks},
    rules:{
      'no-undef':'error',
      'react-hooks/rules-of-hooks':'error',
      'react-hooks/exhaustive-deps':'warn',
    },
  },
]
