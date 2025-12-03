import * as nexus from "nexus-rpc";

/**
 * A service for managing users.
 */
export const userService = nexus.service("UserService", {
  /**
   * Get a user.
   */
  getUser: nexus.operation<GetUserInput, GetUserOutput>(),

  /**
   * Create or update a user.
   */
  setUser: nexus.operation<SetUserInput, SetUserOutput>(),

  /**
   * Delete a user.
   */
  deleteUser: nexus.operation<DeleteUserInput, void>(),
});

export interface GetUserInput {
  /**
   * User ID for the user.
   */
  userId: string;
}

export interface GetUserOutput {
  user: User;
}

/**
 * A user.
 */
export interface User {
  /**
   * Email for the user.
   */
  email?: string;
  /**
   * User ID for the user.
   */
  userId?: string;
}

export interface SetUserInput {
  user: User;
}

export interface SetUserOutput {
  user: User;
}

export interface DeleteUserInput {
  /**
   * User ID for the user.
   */
  userId: string;
}
