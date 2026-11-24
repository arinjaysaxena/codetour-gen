package demo;

import demo.UserRepository;

public class UserController {
    public String list() {
        return new UserRepository().all();
    }
}
