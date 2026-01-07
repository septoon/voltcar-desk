/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      width: {
        // дополнительные промежуточные ширины между w-60 (15rem) и w-80 (20rem)
        "62": "15.5rem",
        "64": "16rem",
        "66": "16.5rem",
        "68": "17rem",
        "70": "17.5rem",
        "72": "18rem",
        "74": "18.5rem",
        "76": "19rem",
        "78": "19.5rem",
        "79": "19.75rem",
      },
    },
  },
  plugins: [],
}
