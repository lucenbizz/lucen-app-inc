const db = {
  from: (table) => ({
    select: (_cols, opts = {}) => ({
      order: () => ({
        range: async () => ({ data: [], error: null, count: 0 })
      })
    }),
  }),
  raw: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {}
  }
};
export default db;
