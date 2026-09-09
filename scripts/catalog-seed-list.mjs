// What the book catalog gets seeded with.
//
// Deliberately not "the first ten thousand books Open Library will give us".
// A catalog is only useful to the person typing into it, and the person typing
// into FirstFinder is cataloguing something they think might be worth
// something. A 2019 airport paperback was never going to be in that set, and
// every row of it makes the eleven guides harder to find in the dropdown.
//
// So: authors whose first editions are actually collected, and the award lists
// that reliably produce collectible firsts. Roughly two to five thousand works
// once Open Library has been asked for each of these -- big enough that search
// is rarely empty, small enough to stay mostly relevant.
//
// This is a starting point, not the plan. The catalog is meant to grow from
// book_catalog_suggestions -- what collectors actually record -- which is a
// better signal than any list assembled up front. See supabase/book-catalog.sql.

// Queried as `author:"Name"`, oldest works first. Modern-firsts collecting,
// genre authors with strong first-edition markets, and the classic-literature
// spine most general collections are built around.
export const AUTHORS = [
  // Modern firsts, US
  "Ernest Hemingway",
  "John Steinbeck",
  "F. Scott Fitzgerald",
  "William Faulkner",
  "Cormac McCarthy",
  "Toni Morrison",
  "Philip Roth",
  "Saul Bellow",
  "John Updike",
  "Don DeLillo",
  "Thomas Pynchon",
  "Kurt Vonnegut",
  "Joseph Heller",
  "Harper Lee",
  "Flannery O'Connor",
  "Raymond Carver",
  "Richard Ford",
  "Annie Proulx",
  "Marilynne Robinson",
  "Jonathan Franzen",
  "Donna Tartt",
  "Colson Whitehead",
  "Jesmyn Ward",
  "Louise Erdrich",

  // Modern firsts, UK and Ireland
  "Graham Greene",
  "Evelyn Waugh",
  "George Orwell",
  "Virginia Woolf",
  "Iris Murdoch",
  "Muriel Spark",
  "Kingsley Amis",
  "Ian McEwan",
  "Kazuo Ishiguro",
  "Julian Barnes",
  "Salman Rushdie",
  "Hilary Mantel",
  "Zadie Smith",
  "Sally Rooney",
  "Seamus Heaney",
  "James Joyce",
  "Samuel Beckett",

  // Crime and thrillers
  "Agatha Christie",
  "Raymond Chandler",
  "Dashiell Hammett",
  "Ian Fleming",
  "John le Carre",
  "Elmore Leonard",
  "James Ellroy",
  "Patricia Highsmith",
  "P. D. James",
  "Ruth Rendell",
  "Michael Connelly",
  "Gillian Flynn",

  // Science fiction and fantasy -- the strongest first-edition market outside
  // modern literary firsts.
  "Frank Herbert",
  "J. R. R. Tolkien",
  "C. S. Lewis",
  "Isaac Asimov",
  "Arthur C. Clarke",
  "Robert A. Heinlein",
  "Philip K. Dick",
  "Ursula K. Le Guin",
  "Ray Bradbury",
  "William Gibson",
  "Neal Stephenson",
  "Octavia E. Butler",
  "Terry Pratchett",
  "Neil Gaiman",
  "George R. R. Martin",
  "Brandon Sanderson",
  "Robin Hobb",
  "N. K. Jemisin",
  "Ann Leckie",
  "Andy Weir",

  // Horror
  "Stephen King",
  "Peter Straub",
  "Clive Barker",
  "Shirley Jackson",
  "Anne Rice",
  "H. P. Lovecraft",
  "Bram Stoker",
  "Mary Shelley",

  // Children's and young adult, where firsts run high
  "J. K. Rowling",
  "Roald Dahl",
  "Maurice Sendak",
  "Dr. Seuss",
  "A. A. Milne",
  "Beatrix Potter",
  "E. B. White",
  "Madeleine L'Engle",
  "Philip Pullman",
  "Suzanne Collins",

  // Nineteenth century and earlier
  "Charles Dickens",
  "Jane Austen",
  "Mark Twain",
  "Herman Melville",
  "Charlotte Bronte",
  "Emily Bronte",
  "Thomas Hardy",
  "Oscar Wilde",
  "Arthur Conan Doyle",
  "Robert Louis Stevenson",
  "Edgar Allan Poe",
  "Walt Whitman",
  "Henry James",
  "Edith Wharton",
  "Willa Cather",

  // Twentieth century in translation, widely collected in first English
  "Gabriel Garcia Marquez",
  "Jorge Luis Borges",
  "Italo Calvino",
  "Albert Camus",
  "Franz Kafka",
  "Haruki Murakami",
  "Umberto Eco"
];

// Open Library subject queries that map well onto award-winning fiction. Used
// in addition to the author sweep, so a one-book award winner who will never
// have a bibliography here still gets in.
export const SUBJECTS = [
  "pulitzer prize winner",
  "booker prize winner",
  "hugo award winner",
  "nebula award winner",
  "national book award winner",
  "nobel prize in literature"
];
