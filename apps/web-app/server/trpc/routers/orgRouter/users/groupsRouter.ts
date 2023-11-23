import { z } from 'zod';
import { parse, stringify } from 'superjson';
import { router, orgProcedure } from '../../../trpc';
import { eq, and } from '@uninbox/database/orm';
import {
  orgMembers,
  userGroupMembers,
  userGroups,
  userProfiles
} from '@uninbox/database/schema';
import { nanoId, nanoIdLength } from '@uninbox/utils';
import { uiColors } from '@uninbox/types/ui';
import type { UiColor } from '@uninbox/types/ui';
import { isUserAdminOfOrg } from '~/server/utils/user';
import { TRPCError } from '@trpc/server';

export const orgUserGroupsRouter = router({
  createOrgUserGroups: orgProcedure
    .input(
      z.object({
        groupName: z.string().min(2).max(50),
        groupDescription: z.string().min(2).max(500).optional(),
        groupColor: z.enum(uiColors)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, user, org } = ctx;
      const userId = user?.id || 0;
      const orgId = org?.id || 0;
      const { groupName, groupDescription, groupColor } = input;
      const newPublicId = nanoId();

      const isAdmin = await isUserAdminOfOrg(org, userId);
      if (!isAdmin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not an admin'
        });
      }

      await db.write.insert(userGroups).values({
        publicId: newPublicId,
        name: groupName,
        description: groupDescription,
        color: groupColor,
        orgId: +orgId,
        avatarId: ''
      });

      return {
        newGroupPublicId: newPublicId
      };
    }),
  getOrgUserGroups: orgProcedure
    .input(z.object({}))
    .query(async ({ ctx, input }) => {
      const { db, user, org } = ctx;
      const userId = user?.id || 0;
      const orgId = org?.id || 0;

      const userGroupQuery = await db.read.query.userGroups.findMany({
        columns: {
          publicId: true,
          name: true,
          description: true,
          color: true,
          avatarId: true
        },
        where: and(eq(userGroups.orgId, +orgId)),
        with: {
          members: {
            columns: {
              publicId: true
            },
            with: {
              userProfile: {
                columns: {
                  publicId: true,
                  avatarId: true,
                  firstName: true,
                  lastName: true,
                  handle: true,
                  title: true
                }
              }
            }
          }
        }
      });

      return {
        groups: userGroupQuery
      };
    }),
  getUserGroup: orgProcedure
    .input(
      z.object({
        userGroupPublicId: z.string().min(3).max(nanoIdLength),
        newUserGroup: z.boolean().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, user, org } = ctx;
      const userId = user?.id || 0;
      const orgId = org?.id || 0;
      const dbReplica = input.newUserGroup ? db.write : db.read;

      const userGroupQuery = await dbReplica.query.userGroups.findFirst({
        columns: {
          publicId: true,
          name: true,
          description: true,
          color: true,
          avatarId: true
        },
        where: and(
          eq(userGroups.publicId, input.userGroupPublicId),
          eq(userGroups.orgId, +orgId)
        ),
        with: {
          members: {
            columns: {
              role: true,
              notifications: true,
              publicId: true
            },
            with: {
              orgMember: {
                columns: {
                  publicId: true
                }
              },
              userProfile: {
                columns: {
                  publicId: true,
                  avatarId: true,
                  firstName: true,
                  lastName: true,
                  handle: true,
                  title: true
                }
              }
            }
          }
        }
      });

      return {
        group: userGroupQuery
      };
    }),
  addUserToGroup: orgProcedure
    .input(
      z.object({
        groupPublicId: z.string().min(3).max(nanoIdLength),
        orgMemberPublicId: z.string().min(3).max(nanoIdLength)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, user, org } = ctx;
      const userId = user?.id || 0;
      const orgId = org?.id || 0;
      const { groupPublicId, orgMemberPublicId } = input;
      const newPublicId = nanoId();

      const isAdmin = await isUserAdminOfOrg(org, userId);
      if (!isAdmin) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not an admin'
        });
      }

      const orgMember = await db.read.query.orgMembers.findFirst({
        columns: {
          userId: true,
          id: true,
          userProfileId: true
        },
        where: eq(orgMembers.publicId, orgMemberPublicId)
      });

      if (!orgMember) {
        throw new Error('User not found');
      }

      const userGroup = await db.read.query.userGroups.findFirst({
        columns: {
          id: true
        },
        where: eq(userGroups.publicId, groupPublicId)
      });

      if (!userGroup) {
        throw new Error('Group not found');
      }

      const insertUserGroupMemberResult = await db.write
        .insert(userGroupMembers)
        .values({
          publicId: newPublicId,
          orgMemberId: orgMember.id,
          userId: orgMember.userId,
          groupId: userGroup.id,
          userProfileId: orgMember.userProfileId,
          role: 'member',
          notifications: 'active',
          addedBy: +userId
        });

      if (!insertUserGroupMemberResult) {
        throw new Error('Could not add user to group');
      }

      return {
        publicId: newPublicId
      };
    })
});
