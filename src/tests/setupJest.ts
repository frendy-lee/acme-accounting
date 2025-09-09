import { Model, ModelCtor } from 'sequelize-typescript';
import { Company } from '../../db/models/Company';
import { Ticket } from '../../db/models/Ticket';
import { User } from '../../db/models/User';

beforeEach(async () => {
  jest.restoreAllMocks();
  await cleanTables();
});

export async function cleanTables() {
  const models: ModelCtor<Model>[] = [Ticket, User, Company];

  for (const model of models) {
    try {
      await model.unscoped().truncate({ cascade: true, restartIdentity: true });
    } catch {
      // Ignore errors during cleanup - tables might not exist yet
      continue;
    }
  }
}
