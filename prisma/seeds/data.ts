import { Difficulty, Prisma, QuestionType, Role } from '@prisma/client';

export type SeedTest = {
  title: string;
  description: string;
  difficulty: Difficulty;
  isPublished: boolean;
  passingScore: number;
  timeLimit: number;
  averageRating: number;
  ratingCount: number;
  authorEmail: string;
  categoryName: string;
  questions: Prisma.QuestionCreateWithoutTestInput[];
};

export const users = [
  {
    email: 'admin@testify.com',
    password: 'password123',
    name: 'Admin User',
    role: Role.ADMIN,
  },
  {
    email: 'teacher1@testify.com',
    password: 'password123',
    name: 'Ivan Teacher',
    role: Role.TEACHER,
  },
  {
    email: 'teacher2@testify.com',
    password: 'password123',
    name: 'Maria Mentor',
    role: Role.TEACHER,
  },
  {
    email: 'student1@testify.com',
    password: 'password123',
    name: 'Oleh Student',
    role: Role.STUDENT,
  },
  {
    email: 'student2@testify.com',
    password: 'password123',
    name: 'Anna Student',
    role: Role.STUDENT,
  },
  {
    email: 'student3@testify.com',
    password: 'password123',
    name: 'Dmytro Student',
    role: Role.STUDENT,
  },
  {
    email: 'student-test@testify.com',
    password: 'password123',
    name: 'Test Student',
    role: Role.STUDENT,
  },
  {
    email: 'teacher3@testify.com',
    password: 'password123',
    name: 'Olena Instructor',
    role: Role.TEACHER,
  },
] satisfies Prisma.UserCreateManyInput[];

export const categories = [
  {
    name: 'JavaScript',
    description: 'Core language syntax, runtime, and browser APIs.',
  },
  {
    name: 'React',
    description: 'Components, hooks, state, and rendering patterns.',
  },
  {
    name: 'NestJS',
    description:
      'Backend architecture with modules, services, and controllers.',
  },
  {
    name: 'Databases',
    description: 'SQL, schema design, relations, and query basics.',
  },
  {
    name: 'TypeScript',
    description: 'Static typing, interfaces, generics, and narrowing.',
  },
  {
    name: 'Node.js',
    description: 'Runtime APIs, asynchronous code, packages, and streams.',
  },
  {
    name: 'HTML & CSS',
    description: 'Semantic markup, selectors, layout, and responsive styling.',
  },
  {
    name: 'Testing',
    description: 'Unit tests, integration tests, mocks, and test strategy.',
  },
] satisfies Prisma.CategoryCreateManyInput[];

const tagLinks = (
  ...names: string[]
): Prisma.QuestionCreateWithoutTestInput['tags'] => ({
  connectOrCreate: names.map((name) => ({
    where: { name },
    create: { name },
  })),
});

export const tests: SeedTest[] = [
  {
    title: 'JavaScript Fundamentals',
    description: 'Variables, types, functions, arrays, and basic control flow.',
    difficulty: Difficulty.BEGINNER,
    isPublished: true,
    passingScore: 60,
    timeLimit: 10,
    averageRating: 4.5,
    ratingCount: 12,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'JavaScript',
    questions: [
      {
        text: 'Which keyword declares a block-scoped variable?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        teacherInsight:
          'let and const are block-scoped; var is function-scoped.',
        tags: {
          connectOrCreate: [
            {
              where: { name: 'variables' },
              create: { name: 'variables' },
            },
            {
              where: { name: 'scope' },
              create: { name: 'scope' },
            },
          ],
        },
        options: {
          create: [
            { text: 'var', isCorrect: false },
            { text: 'let', isCorrect: true },
            { text: 'function', isCorrect: false },
            { text: 'import', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which array method creates a new array by transforming every item?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'arrays' },
              create: { name: 'arrays' },
            },
          ],
        },
        options: {
          create: [
            { text: 'map', isCorrect: true },
            { text: 'push', isCorrect: false },
            { text: 'forEach', isCorrect: false },
            { text: 'includes', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'Closures and this',
    description: 'Scope chains, lexical closures, and function context.',
    difficulty: Difficulty.ADVANCED,
    isPublished: true,
    passingScore: 80,
    timeLimit: 45,
    averageRating: 3.8,
    ratingCount: 7,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'JavaScript',
    questions: [
      {
        text: 'What does a closure allow a function to access?',
        type: QuestionType.SINGLE_CHOICE,
        points: 2,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'closures' },
              create: { name: 'closures' },
            },
          ],
        },
        options: {
          create: [
            { text: 'Only global variables', isCorrect: false },
            { text: 'Variables from its outer lexical scope', isCorrect: true },
            { text: 'Only variables passed as arguments', isCorrect: false },
            { text: 'Private class fields only', isCorrect: false },
          ],
        },
      },
      {
        text: 'Arrow functions have their own this binding.',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'this' },
              create: { name: 'this' },
            },
          ],
        },
        options: {
          create: [
            { text: 'True', isCorrect: false },
            { text: 'False', isCorrect: true },
          ],
        },
      },
    ],
  },
  {
    title: 'React Hooks Mastery',
    description: 'useState, useEffect, custom hooks, and dependency arrays.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 25,
    averageRating: 5,
    ratingCount: 18,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'React',
    questions: [
      {
        text: 'Which hook is used for local component state?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'hooks' },
              create: { name: 'hooks' },
            },
            {
              where: { name: 'state' },
              create: { name: 'state' },
            },
          ],
        },
        options: {
          create: [
            { text: 'useEffect', isCorrect: false },
            { text: 'useMemo', isCorrect: false },
            { text: 'useState', isCorrect: true },
            { text: 'useRef', isCorrect: false },
          ],
        },
      },
      {
        text: 'What should be listed in a useEffect dependency array?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        teacherInsight:
          'Dependencies should include values from component scope used by the effect.',
        tags: {
          connectOrCreate: [
            {
              where: { name: 'effects' },
              create: { name: 'effects' },
            },
          ],
        },
        options: {
          create: [
            { text: 'Props read inside the effect', isCorrect: true },
            { text: 'State read inside the effect', isCorrect: true },
            { text: 'Unrelated constants from another file', isCorrect: false },
            { text: 'Nothing, always leave it empty', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'NestJS Architecture',
    description: 'Modules, controllers, providers, and dependency injection.',
    difficulty: Difficulty.ADVANCED,
    isPublished: false,
    passingScore: 85,
    timeLimit: 90,
    averageRating: 0,
    ratingCount: 0,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'NestJS',
    questions: [
      {
        text: 'Which decorator marks a class as a Nest module?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: {
          connectOrCreate: [
            {
              where: { name: 'nestjs' },
              create: { name: 'nestjs' },
            },
            {
              where: { name: 'modules' },
              create: { name: 'modules' },
            },
          ],
        },
        options: {
          create: [
            { text: '@Controller()', isCorrect: false },
            { text: '@Module()', isCorrect: true },
            { text: '@Inject()', isCorrect: false },
            { text: '@Service()', isCorrect: false },
          ],
        },
      },
      {
        text: 'What does dependency injection help with in NestJS?',
        type: QuestionType.TEXT_ANSWER,
        points: 2,
        correctTextAnswer:
          'easier composition, testing, and swapping dependencies',
        teacherInsight:
          'Expected answer: easier composition, testing, and swapping dependencies.',
        tags: {
          connectOrCreate: [
            {
              where: { name: 'dependency-injection' },
              create: { name: 'dependency-injection' },
            },
          ],
        },
      },
    ],
  },
  {
    title: 'Database Design Basics',
    description:
      'Primary keys, foreign keys, normalization, and query thinking.',
    difficulty: Difficulty.BEGINNER,
    isPublished: true,
    passingScore: 65,
    timeLimit: 20,
    averageRating: 4.2,
    ratingCount: 9,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'Databases',
    questions: [
      {
        text: 'What is the main purpose of a primary key?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('databases', 'primary-key'),
        options: {
          create: [
            { text: 'To uniquely identify each row', isCorrect: true },
            { text: 'To store long text values', isCorrect: false },
            { text: 'To automatically encrypt the table', isCorrect: false },
            { text: 'To remove duplicate columns', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which statements describe a foreign key?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        teacherInsight:
          'A foreign key connects one table to a row in another table and protects referential integrity.',
        tags: tagLinks('databases', 'relations'),
        options: {
          create: [
            { text: 'It references a key in another table', isCorrect: true },
            {
              text: 'It can help preserve referential integrity',
              isCorrect: true,
            },
            { text: 'It must always be a text column', isCorrect: false },
            { text: 'It replaces all indexes in a database', isCorrect: false },
          ],
        },
      },
      {
        text: 'Briefly explain why normalization can reduce data duplication.',
        type: QuestionType.TEXT_ANSWER,
        points: 3,
        correctTextAnswer:
          'related facts are moved into separate tables and referenced instead of repeated',
        teacherInsight:
          'Expected answer: related facts are moved into separate tables and referenced instead of repeated.',
        tags: tagLinks('normalization', 'schema-design'),
      },
    ],
  },
  {
    title: 'SQL Query Practice',
    description: 'Filtering, sorting, grouping, and joining relational data.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 35,
    averageRating: 4.7,
    ratingCount: 15,
    authorEmail: 'teacher3@testify.com',
    categoryName: 'Databases',
    questions: [
      {
        text: 'Which SQL clause filters rows before grouping?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'filtering'),
        options: {
          create: [
            { text: 'WHERE', isCorrect: true },
            { text: 'ORDER BY', isCorrect: false },
            { text: 'LIMIT', isCorrect: false },
            { text: 'HAVING', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which SQL clause is used to filter grouped results?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'grouping'),
        options: {
          create: [
            { text: 'HAVING', isCorrect: true },
            { text: 'SELECT', isCorrect: false },
            { text: 'JOIN', isCorrect: false },
            { text: 'OFFSET', isCorrect: false },
          ],
        },
      },
      {
        text: 'What is the difference between INNER JOIN and LEFT JOIN?',
        type: QuestionType.TEXT_ANSWER,
        points: 3,
        correctTextAnswer:
          'INNER JOIN keeps matching rows only; LEFT JOIN keeps all left-side rows and matching right-side data',
        acceptedTextAnswers: [
          'inner join keeps matching rows; left join keeps all left rows',
          'inner join matching rows left join all left rows',
        ],
        teacherInsight:
          'Expected answer: INNER JOIN keeps matching rows only; LEFT JOIN keeps all left-side rows and matching right-side data.',
        tags: tagLinks('sql', 'joins'),
      },
    ],
  },
  {
    title: 'SQL Joins and Grouping Sprint',
    description:
      'A short practice test for SQL joins, grouped filtering, and relational query logic.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 8,
    averageRating: 4.9,
    ratingCount: 6,
    authorEmail: 'teacher3@testify.com',
    categoryName: 'Databases',
    questions: [
      {
        text: 'Which join returns only rows that have matches in both tables?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'joins', 'grouping'),
        options: {
          create: [
            { text: 'INNER JOIN', isCorrect: true },
            { text: 'LEFT JOIN', isCorrect: false },
            { text: 'CROSS JOIN', isCorrect: false },
            { text: 'FULL OUTER JOIN', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which clause filters results after GROUP BY is applied?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'joins', 'grouping'),
        options: {
          create: [
            { text: 'WHERE', isCorrect: false },
            { text: 'HAVING', isCorrect: true },
            { text: 'ORDER BY', isCorrect: false },
            { text: 'LIMIT', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which join keeps every row from the left table?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'joins', 'grouping'),
        options: {
          create: [
            { text: 'INNER JOIN', isCorrect: false },
            { text: 'LEFT JOIN', isCorrect: true },
            { text: 'CROSS JOIN', isCorrect: false },
            { text: 'SELF JOIN', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'Advanced SQL Aggregations',
    description:
      'Aggregate functions, grouped metrics, HAVING filters, and window function basics.',
    difficulty: Difficulty.ADVANCED,
    isPublished: true,
    passingScore: 75,
    timeLimit: 30,
    averageRating: 4.8,
    ratingCount: 18,
    authorEmail: 'teacher3@testify.com',
    categoryName: 'Databases',
    questions: [
      {
        text: 'Which SQL function counts rows in each group?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'grouping'),
        options: {
          create: [
            { text: 'COUNT(*)', isCorrect: true },
            { text: 'ORDER BY', isCorrect: false },
            { text: 'INNER JOIN', isCorrect: false },
            { text: 'LIMIT', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which clause is commonly used with aggregate functions to create groups?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'grouping'),
        options: {
          create: [
            { text: 'GROUP BY', isCorrect: true },
            { text: 'WHERE', isCorrect: false },
            { text: 'OFFSET', isCorrect: false },
            { text: 'INSERT INTO', isCorrect: false },
          ],
        },
      },
      {
        text: 'What does ROW_NUMBER() OVER (...) help calculate?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'window-functions'),
        options: {
          create: [
            { text: 'A row position within a window or partition', isCorrect: true },
            { text: 'The database server version', isCorrect: false },
            { text: 'The number of tables in a schema', isCorrect: false },
            { text: 'A password hash for each user', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'Database Indexes and Query Plans',
    description:
      'Indexes, query plans, lookup cost, and practical database optimization.',
    difficulty: Difficulty.ADVANCED,
    isPublished: true,
    passingScore: 75,
    timeLimit: 35,
    averageRating: 4.5,
    ratingCount: 14,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'Databases',
    questions: [
      {
        text: 'What is a common purpose of a database index?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('databases', 'indexes'),
        options: {
          create: [
            { text: 'Speeding up lookups for selected columns', isCorrect: true },
            { text: 'Replacing every table with a JSON file', isCorrect: false },
            { text: 'Disabling all constraints', isCorrect: false },
            { text: 'Automatically writing frontend code', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which tool helps inspect how a SQL query may be executed?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('sql', 'query-optimization'),
        options: {
          create: [
            { text: 'EXPLAIN', isCorrect: true },
            { text: 'DROP', isCorrect: false },
            { text: 'TRUNCATE', isCorrect: false },
            { text: 'COMMIT', isCorrect: false },
          ],
        },
      },
      {
        text: 'Why can too many indexes slow down write operations?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('databases', 'indexes', 'query-optimization'),
        options: {
          create: [
            { text: 'Each insert or update may also update index structures', isCorrect: true },
            { text: 'Indexes remove all primary keys', isCorrect: false },
            { text: 'Indexes force every query to scan all rows', isCorrect: false },
            { text: 'Indexes disable transactions', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'React State Management Practice',
    description:
      'Local state, derived state, context, and predictable updates in React applications.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 25,
    averageRating: 4.4,
    ratingCount: 13,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'React',
    questions: [
      {
        text: 'Which hook is commonly used for local component state?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('react', 'state'),
        options: {
          create: [
            { text: 'useState', isCorrect: true },
            { text: 'useFolder', isCorrect: false },
            { text: 'useSQL', isCorrect: false },
            { text: 'useClassNameOnly', isCorrect: false },
          ],
        },
      },
      {
        text: 'When is React Context useful?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('react', 'context'),
        options: {
          create: [
            { text: 'Sharing values across a component tree', isCorrect: true },
            { text: 'Creating database migrations', isCorrect: false },
            { text: 'Replacing HTML semantics', isCorrect: false },
            { text: 'Compressing images automatically', isCorrect: false },
          ],
        },
      },
      {
        text: 'What is derived state?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('react', 'state'),
        options: {
          create: [
            { text: 'A value calculated from existing state or props', isCorrect: true },
            { text: 'State stored only in CSS files', isCorrect: false },
            { text: 'A state value that cannot change', isCorrect: false },
            { text: 'A backend-only environment variable', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'Node.js Async Patterns',
    description:
      'Promises, async/await, error handling, and concurrent asynchronous work.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 25,
    averageRating: 4.3,
    ratingCount: 11,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'Node.js',
    questions: [
      {
        text: 'What does async/await primarily improve?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('nodejs', 'async', 'promises'),
        options: {
          create: [
            { text: 'Readability of Promise-based asynchronous code', isCorrect: true },
            { text: 'CSS layout performance', isCorrect: false },
            { text: 'SQL table normalization', isCorrect: false },
            { text: 'Static HTML validation', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which method waits for multiple promises to resolve?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('nodejs', 'async', 'promises'),
        options: {
          create: [
            { text: 'Promise.all', isCorrect: true },
            { text: 'Array.join', isCorrect: false },
            { text: 'JSON.stringify', isCorrect: false },
            { text: 'process.exit', isCorrect: false },
          ],
        },
      },
      {
        text: 'How can async/await errors be handled?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('nodejs', 'async'),
        options: {
          create: [
            { text: 'With try/catch around awaited calls', isCorrect: true },
            { text: 'Only with HTML forms', isCorrect: false },
            { text: 'Only by restarting the database', isCorrect: false },
            { text: 'By disabling TypeScript', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'CSS Flexbox and Grid Basics',
    description:
      'Practical layout questions for flex containers, grid tracks, and responsive interfaces.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 20,
    averageRating: 4.2,
    ratingCount: 10,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'HTML & CSS',
    questions: [
      {
        text: 'Which CSS property enables flex layout on an element?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('css', 'layout'),
        options: {
          create: [
            { text: 'display: flex', isCorrect: true },
            { text: 'position: database', isCorrect: false },
            { text: 'font-mode: grid', isCorrect: false },
            { text: 'layout: promise', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which CSS property defines columns in a grid container?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('css', 'layout'),
        options: {
          create: [
            { text: 'grid-template-columns', isCorrect: true },
            { text: 'columns-template-grid', isCorrect: false },
            { text: 'flex-column-count', isCorrect: false },
            { text: 'table-columns-only', isCorrect: false },
          ],
        },
      },
      {
        text: 'What is the main goal of responsive design?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('css', 'responsive-design'),
        options: {
          create: [
            { text: 'Adapting layout to different screen sizes', isCorrect: true },
            { text: 'Removing all media queries from CSS', isCorrect: false },
            { text: 'Making every page fixed width', isCorrect: false },
            { text: 'Moving all styles into SQL', isCorrect: false },
          ],
        },
      },
    ],
  },
  {
    title: 'TypeScript Essentials',
    description: 'Types, interfaces, unions, and safer JavaScript patterns.',
    difficulty: Difficulty.BEGINNER,
    isPublished: true,
    passingScore: 60,
    timeLimit: 20,
    averageRating: 4.6,
    ratingCount: 20,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'TypeScript',
    questions: [
      {
        text: 'Which syntax defines a variable that can be a string or a number?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('typescript', 'union-types'),
        options: {
          create: [
            { text: 'let id: string | number', isCorrect: true },
            { text: 'let id: string & number', isCorrect: false },
            { text: 'let id: string, number', isCorrect: false },
            { text: 'let id = string || number', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which TypeScript features can describe object shapes?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        tags: tagLinks('typescript', 'interfaces'),
        options: {
          create: [
            { text: 'interface', isCorrect: true },
            { text: 'type alias', isCorrect: true },
            { text: 'console.log', isCorrect: false },
            { text: 'setTimeout', isCorrect: false },
          ],
        },
      },
      {
        text: 'What does type narrowing help TypeScript understand?',
        type: QuestionType.TEXT_ANSWER,
        points: 2,
        correctTextAnswer:
          'checks reduce a broad type to a more specific type in a code branch',
        teacherInsight:
          'Expected answer: checks reduce a broad type to a more specific type in a code branch.',
        tags: tagLinks('typescript', 'narrowing'),
      },
    ],
  },
  {
    title: 'Advanced TypeScript Generics',
    description:
      'Generic functions, constraints, keyof, and reusable typed APIs.',
    difficulty: Difficulty.ADVANCED,
    isPublished: false,
    passingScore: 80,
    timeLimit: 50,
    averageRating: 0,
    ratingCount: 0,
    authorEmail: 'teacher3@testify.com',
    categoryName: 'TypeScript',
    questions: [
      {
        text: 'What does a generic type parameter allow a function to do?',
        type: QuestionType.SINGLE_CHOICE,
        points: 2,
        tags: tagLinks('typescript', 'generics'),
        options: {
          create: [
            {
              text: 'Work with different types while preserving type information',
              isCorrect: true,
            },
            { text: 'Skip all compile-time checks', isCorrect: false },
            { text: 'Convert TypeScript to CSS', isCorrect: false },
            { text: 'Force every value to be any', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which operator creates a union of property names from a type?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('typescript', 'keyof'),
        options: {
          create: [
            { text: 'keyof', isCorrect: true },
            { text: 'typeof', isCorrect: false },
            { text: 'instanceof', isCorrect: false },
            { text: 'await', isCorrect: false },
          ],
        },
      },
      {
        text: 'Why might you add a generic constraint such as T extends { id: string }?',
        type: QuestionType.TEXT_ANSWER,
        points: 3,
        correctTextAnswer:
          'it guarantees the generic value has an id property while keeping other fields flexible',
        teacherInsight:
          'Expected answer: it guarantees the generic value has an id property while keeping other fields flexible.',
        tags: tagLinks('typescript', 'constraints'),
      },
    ],
  },
  {
    title: 'Node.js Runtime Basics',
    description:
      'Modules, package scripts, asynchronous APIs, and environment variables.',
    difficulty: Difficulty.BEGINNER,
    isPublished: true,
    passingScore: 60,
    timeLimit: 20,
    averageRating: 4.1,
    ratingCount: 8,
    authorEmail: 'teacher1@testify.com',
    categoryName: 'Node.js',
    questions: [
      {
        text: 'Where are project scripts usually defined in a Node.js project?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('nodejs', 'npm'),
        options: {
          create: [
            { text: 'package.json', isCorrect: true },
            { text: 'README.md only', isCorrect: false },
            { text: 'tsconfig.json only', isCorrect: false },
            { text: 'node_modules/.env', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which APIs are commonly asynchronous in Node.js?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        tags: tagLinks('nodejs', 'async'),
        options: {
          create: [
            { text: 'File system operations', isCorrect: true },
            { text: 'Network requests', isCorrect: true },
            { text: 'String length access', isCorrect: false },
            { text: 'Basic arithmetic', isCorrect: false },
          ],
        },
      },
      {
        text: 'Why should secrets usually come from environment variables?',
        type: QuestionType.TEXT_ANSWER,
        points: 2,
        correctTextAnswer:
          'secrets stay outside source code and can differ by environment',
        teacherInsight:
          'Expected answer: secrets stay outside source code and can differ by environment.',
        tags: tagLinks('nodejs', 'environment'),
      },
    ],
  },
  {
    title: 'HTML and CSS Layout',
    description:
      'Semantic elements, selectors, flexbox, grid, and responsive rules.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 70,
    timeLimit: 30,
    averageRating: 4.4,
    ratingCount: 11,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'HTML & CSS',
    questions: [
      {
        text: 'Which HTML element best represents primary page navigation?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('html', 'semantics'),
        options: {
          create: [
            { text: '<nav>', isCorrect: true },
            { text: '<span>', isCorrect: false },
            { text: '<b>', isCorrect: false },
            { text: '<script>', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which CSS tools are commonly used for two-dimensional or one-dimensional layout?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        tags: tagLinks('css', 'layout'),
        options: {
          create: [
            { text: 'CSS Grid', isCorrect: true },
            { text: 'Flexbox', isCorrect: true },
            { text: 'localStorage', isCorrect: false },
            { text: 'JSON.parse', isCorrect: false },
          ],
        },
      },
      {
        text: 'What does a media query help you change?',
        type: QuestionType.TEXT_ANSWER,
        points: 2,
        correctTextAnswer:
          'styles can change based on viewport size, device capabilities, or other media features',
        teacherInsight:
          'Expected answer: styles can change based on viewport size, device capabilities, or other media features.',
        tags: tagLinks('css', 'responsive-design'),
      },
    ],
  },
  {
    title: 'Jest Testing Basics',
    description:
      'Assertions, arrange-act-assert structure, mocks, and coverage.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: true,
    passingScore: 75,
    timeLimit: 30,
    averageRating: 4.9,
    ratingCount: 14,
    authorEmail: 'teacher3@testify.com',
    categoryName: 'Testing',
    questions: [
      {
        text: 'Which Jest function is commonly used to define a test case?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('jest', 'unit-tests'),
        options: {
          create: [
            { text: 'it', isCorrect: true },
            { text: 'renderOnly', isCorrect: false },
            { text: 'compileCss', isCorrect: false },
            { text: 'schema', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which statements are good unit testing practices?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        tags: tagLinks('testing', 'unit-tests'),
        options: {
          create: [
            { text: 'Test one behavior clearly', isCorrect: true },
            {
              text: 'Use assertions that describe expected outcomes',
              isCorrect: true,
            },
            { text: 'Depend on test execution order', isCorrect: false },
            {
              text: 'Hide all failures with empty catch blocks',
              isCorrect: false,
            },
          ],
        },
      },
      {
        text: 'When is mocking a dependency useful?',
        type: QuestionType.TEXT_ANSWER,
        points: 2,
        correctTextAnswer:
          'when isolating the unit under test or replacing slow external dependencies',
        teacherInsight:
          'Expected answer: when isolating the unit under test or replacing slow/external dependencies.',
        tags: tagLinks('testing', 'mocks'),
      },
    ],
  },
  {
    title: 'React Performance Patterns',
    description:
      'Memoization, rendering cost, stable references, and list optimization.',
    difficulty: Difficulty.ADVANCED,
    isPublished: true,
    passingScore: 80,
    timeLimit: 45,
    averageRating: 4.3,
    ratingCount: 10,
    authorEmail: 'teacher2@testify.com',
    categoryName: 'React',
    questions: [
      {
        text: 'What does React.memo help avoid?',
        type: QuestionType.SINGLE_CHOICE,
        points: 2,
        tags: tagLinks('react', 'performance'),
        options: {
          create: [
            {
              text: 'Unnecessary re-renders when props are equal',
              isCorrect: true,
            },
            { text: 'All network requests', isCorrect: false },
            { text: 'Every JavaScript error', isCorrect: false },
            { text: 'CSS specificity issues', isCorrect: false },
          ],
        },
      },
      {
        text: 'Which hooks can help keep expensive values or callbacks stable?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        tags: tagLinks('react', 'memoization'),
        options: {
          create: [
            { text: 'useMemo', isCorrect: true },
            { text: 'useCallback', isCorrect: true },
            { text: 'useRandomEffect', isCorrect: false },
            { text: 'useCssGrid', isCorrect: false },
          ],
        },
      },
      {
        text: 'Why are stable keys important when rendering lists?',
        type: QuestionType.TEXT_ANSWER,
        points: 2,
        correctTextAnswer:
          'keys help React match list items across renders and avoid incorrect DOM state reuse',
        teacherInsight:
          'Expected answer: keys help React match list items across renders and avoid incorrect DOM/state reuse.',
        tags: tagLinks('react', 'lists'),
      },
    ],
  },
  {
    title: 'NestJS Guards and Pipes',
    description:
      'Request validation, authorization checks, guards, pipes, and metadata.',
    difficulty: Difficulty.INTERMEDIATE,
    isPublished: false,
    passingScore: 75,
    timeLimit: 40,
    averageRating: 0,
    ratingCount: 0,
    authorEmail: 'teacher3@testify.com',
    categoryName: 'NestJS',
    questions: [
      {
        text: 'What is a common use case for a NestJS guard?',
        type: QuestionType.SINGLE_CHOICE,
        points: 1,
        tags: tagLinks('nestjs', 'guards'),
        options: {
          create: [
            {
              text: 'Deciding whether a request can continue',
              isCorrect: true,
            },
            { text: 'Rendering browser CSS', isCorrect: false },
            { text: 'Compiling TypeScript types at runtime', isCorrect: false },
            {
              text: 'Creating database indexes automatically',
              isCorrect: false,
            },
          ],
        },
      },
      {
        text: 'Which tasks can pipes handle in NestJS?',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        tags: tagLinks('nestjs', 'pipes'),
        options: {
          create: [
            { text: 'Validation', isCorrect: true },
            { text: 'Transformation', isCorrect: true },
            { text: 'Serving static HTML by default', isCorrect: false },
            { text: 'Changing Git branches', isCorrect: false },
          ],
        },
      },
      {
        text: 'How can route metadata help authorization logic?',
        type: QuestionType.TEXT_ANSWER,
        points: 3,
        correctTextAnswer:
          'decorators can attach role or permission metadata that guards read before allowing access',
        teacherInsight:
          'Expected answer: decorators can attach role or permission metadata that guards read before allowing access.',
        tags: tagLinks('nestjs', 'authorization'),
      },
    ],
  },
];
